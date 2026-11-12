import 'dart:async';
import 'package:flutter/foundation.dart';
import '../models/email_summary.dart';
import '../models/email_detail.dart';
import '../models/ai_analysis.dart';
import '../services/api_service.dart';

/// Representation of supported German mailbox folders and their API keys.
enum MailFolder {
  inbox('inbox', 'Posteingang'),
  sent('sent', 'Gesendet'),
  archive('archive', 'Archiv'),
  trash('trash', 'Papierkorb');

  final String apiKey;
  final String displayName;

  const MailFolder(this.apiKey, this.displayName);

  static MailFolder fromApiKey(String? key) {
    if (key == null) return MailFolder.inbox;
    return MailFolder.values.firstWhere(
      (f) => f.apiKey.toLowerCase() == key.toLowerCase(),
      orElse: () => MailFolder.inbox,
    );
  }
}

/// State provider managing mailbox stream, folder caching, unread counts,
/// IMAP synchronization, and optimistic UI mutations.
class MailProvider extends ChangeNotifier {
  final ApiService _apiService;

  // Active folder
  MailFolder _currentFolder = MailFolder.inbox;

  // Multi-folder SWR cache: folderApiKey -> List<EmailSummary>
  final Map<String, List<EmailSummary>> _folderEmailCache = {};

  // Email detail cache: seq -> EmailDetail
  final Map<int, EmailDetail> _detailsCache = {};

  // AI analysis cache: seq -> AiAnalysisResult
  final Map<int, AiAnalysisResult> _aiCache = {};

  // Granular loading & sync states
  bool _isLoading = false;
  bool _isRefreshing = false;
  String? _errorMessage;
  String? _accountEmail;

  // Search and client-side filtering
  String _searchQuery = '';
  String _filterTab = 'all'; // 'all' | 'unread'

  MailProvider({ApiService? apiService})
      : _apiService = apiService ?? ApiService();

  // ===========================================================================
  // GETTERS
  // ===========================================================================

  /// Active folder API key (e.g. 'inbox', 'sent', 'archive', 'trash')
  String get currentFolder => _currentFolder.apiKey;

  /// Active folder enum instance
  MailFolder get currentMailFolder => _currentFolder;

  /// German localized title of active folder (e.g. "Posteingang")
  String get currentFolderDisplayName => _currentFolder.displayName;

  /// Unfiltered list of emails currently in active folder cache
  List<EmailSummary> get emails =>
      _folderEmailCache[_currentFolder.apiKey] ?? const [];

  /// Filtered list of emails respecting search query and active tab ('all' vs 'unread')
  List<EmailSummary> get filteredEmails {
    var list = emails;

    // Filter by tab
    if (_filterTab == 'unread') {
      list = list.where((m) => m.isUnread).toList();
    }

    // Filter by search query
    final query = _searchQuery.trim().toLowerCase();
    if (query.isNotEmpty) {
      list = list.where((m) {
        final matchSubject = m.subject.toLowerCase().contains(query);
        final matchName = m.senderName.toLowerCase().contains(query);
        final matchEmail = m.fromAddress.toLowerCase().contains(query);
        final matchSnippet = (m.snippet ?? '').toLowerCase().contains(query);
        return matchSubject || matchName || matchEmail || matchSnippet;
      }).toList();
    }

    return list;
  }

  /// Initial loading indicator (true ONLY when active folder has no cached data)
  bool get isLoading => _isLoading;

  /// Refresh indicator (true during pull-to-refresh or background sync)
  bool get isRefreshing => _isRefreshing;

  /// General syncing indicator driving top-bar rotation
  bool get isSyncing => _isLoading || _isRefreshing;

  /// Active error message for current folder, if any
  String? get errorMessage => _errorMessage;

  /// True if an error occurred during fetch
  bool get hasError => _errorMessage != null;

  /// True if folder has no emails and is not loading
  bool get isEmpty => emails.isEmpty && !_isLoading && _errorMessage == null;

  /// Count of unread emails in active folder
  int get unreadCount => emails.where((e) => e.isUnread).length;

  /// Count of unread emails in Posteingang (inbox)
  int get inboxUnreadCount => unreadCountForFolder('inbox');

  /// Read-only snapshot of cached email details
  Map<int, EmailDetail> get detailsCache => Map.unmodifiable(_detailsCache);

  /// Read-only snapshot of cached AI analysis results
  Map<int, AiAnalysisResult> get aiCache => Map.unmodifiable(_aiCache);

  /// Connected IMAP account email address
  String? get accountEmail => _accountEmail;

  /// Current search filter query
  String get searchQuery => _searchQuery;

  /// Current filter tab ('all' or 'unread')
  String get filterTab => _filterTab;

  /// Returns unread count for any specific folder key
  int unreadCountForFolder(String folderKey) {
    final list = _folderEmailCache[folderKey] ?? const [];
    return list.where((e) => e.isUnread).length;
  }

  /// Returns a map of all known folders to their unread count
  Map<String, int> get folderUnreadCounts {
    final counts = <String, int>{};
    for (final folder in MailFolder.values) {
      counts[folder.apiKey] = unreadCountForFolder(folder.apiKey);
    }
    return counts;
  }

  // ===========================================================================
  // AUTH LIFECYCLE SYNC
  // ===========================================================================

  /// Synchronizes authentication token and server base URL from AuthProvider.
  void updateAuth({
    String? authToken,
    String? baseUrl,
    String? userEmail,
  }) {
    if (baseUrl != null && baseUrl.isNotEmpty) {
      _apiService.setBaseUrl(baseUrl);
    }

    final tokenChanged = _apiService.authToken != authToken;
    _apiService.setAuthToken(authToken);

    if (userEmail != null) {
      _accountEmail = userEmail;
    }

    // If logged out: wipe all cached data immediately
    if (authToken == null || authToken.isEmpty) {
      clearAll();
      return;
    }

    // If new token authenticated and inbox cache is empty, fetch initial inbox
    if (tokenChanged && !_folderEmailCache.containsKey('inbox')) {
      fetchEmails(folder: 'inbox');
    }
  }

  // ===========================================================================
  // FOLDER SWITCHING & FETCHING
  // ===========================================================================

  /// Switches active folder with instant 0ms cached display and background revalidation.
  Future<void> selectFolder(dynamic folder) async {
    final targetFolder = folder is MailFolder
        ? folder
        : MailFolder.fromApiKey(folder?.toString());

    if (_currentFolder == targetFolder &&
        _folderEmailCache.containsKey(targetFolder.apiKey)) {
      return; // Already active and cached
    }

    _currentFolder = targetFolder;
    _errorMessage = null;
    _searchQuery = '';
    _filterTab = 'all';

    // SWR pattern: if cached, switch instantly and revalidate in background
    if (_folderEmailCache.containsKey(targetFolder.apiKey)) {
      _isLoading = false;
      notifyListeners();
      await _fetchEmailsInternal(targetFolder.apiKey, isBackground: true);
    } else {
      _isLoading = true;
      notifyListeners();
      await _fetchEmailsInternal(targetFolder.apiKey, isBackground: false);
    }
  }

  /// Fetches emails for a specified folder or currently active folder.
  Future<void> fetchEmails({String? folder, bool refresh = false}) async {
    final target = folder ?? _currentFolder.apiKey;
    final isCached = _folderEmailCache.containsKey(target);

    if (refresh) {
      await refreshCurrentFolder();
      return;
    }

    if (isCached) {
      await _fetchEmailsInternal(target, isBackground: true);
    } else {
      _isLoading = true;
      _errorMessage = null;
      notifyListeners();
      await _fetchEmailsInternal(target, isBackground: false);
    }
  }

  /// Pull-to-refresh handler: refreshes the currently active folder.
  Future<void> refreshCurrentFolder() async {
    _isRefreshing = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final fetched = await _apiService.getEmails(folder: _currentFolder.apiKey);
      _folderEmailCache[_currentFolder.apiKey] = List<EmailSummary>.from(fetched);
    } catch (e) {
      // If folder has cached items, non-blocking: don't overwrite UI with full error view
      if (!_folderEmailCache.containsKey(_currentFolder.apiKey) ||
          _folderEmailCache[_currentFolder.apiKey]!.isEmpty) {
        _errorMessage = e.toString();
      }
    } finally {
      _isRefreshing = false;
      notifyListeners();
    }
  }

  /// Internal worker executing network fetch with appropriate loading flags.
  Future<void> _fetchEmailsInternal(
    String folderKey, {
    required bool isBackground,
  }) async {
    if (isBackground) {
      _isRefreshing = true;
    } else {
      _isLoading = true;
    }
    notifyListeners();

    try {
      final fetched = await _apiService.getEmails(folder: folderKey);
      _folderEmailCache[folderKey] = List<EmailSummary>.from(fetched);
      _errorMessage = null;
    } catch (e) {
      if (!isBackground ||
          !_folderEmailCache.containsKey(folderKey) ||
          _folderEmailCache[folderKey]!.isEmpty) {
        _errorMessage = e.toString();
      }
    } finally {
      if (isBackground) {
        _isRefreshing = false;
      } else {
        _isLoading = false;
      }
      notifyListeners();
    }
  }

  // ===========================================================================
  // EMAIL DETAIL & AI ANALYSIS CACHING
  // ===========================================================================

  /// Fetches full email detail with MIME parts, caching in memory.
  Future<EmailDetail?> fetchEmailDetail(
    int seq, {
    String? folder,
  }) async {
    final targetFolder = folder ?? _currentFolder.apiKey;

    // Return cached detail immediately if available
    if (_detailsCache.containsKey(seq)) {
      return _detailsCache[seq];
    }

    try {
      final detail = await _apiService.getEmail(seq, folder: targetFolder);
      _detailsCache[seq] = detail;

      // Ensure read flag aligns with detail
      if (detail.read) {
        _updateSummaryFlagInMemory(seq, targetFolder, read: true);
      }

      notifyListeners();
      return detail;
    } catch (e) {
      debugPrint('fetchEmailDetail error for seq $seq: $e');
      return null;
    }
  }

  /// Analyzes email via POST /api/ai/analyze, caching result per message.
  Future<AiAnalysisResult?> triggerAiAnalysis(
    EmailDetail email, {
    bool force = false,
  }) async {
    if (!force && _aiCache.containsKey(email.seq)) {
      return _aiCache[email.seq];
    }

    try {
      final result = await _apiService.analyzeEmail(
        subject: email.subject,
        from: email.name.isNotEmpty
            ? '${email.name} <${email.email}>'
            : email.email,
        text: email.text,
        html: email.html,
      );

      _aiCache[email.seq] = result;
      notifyListeners();
      return result;
    } catch (e) {
      debugPrint('triggerAiAnalysis error for seq ${email.seq}: $e');
      rethrow;
    }
  }

  /// Toggles completion checkbox of an AI-generated action item.
  void toggleActionItem(int seq, int taskIndex) {
    final analysis = _aiCache[seq];
    if (analysis == null || taskIndex >= analysis.actionItems.length) return;

    final items = List<ActionItem>.from(analysis.actionItems);
    final target = items[taskIndex];
    items[taskIndex] = target.copyWith(completed: !target.completed);

    _aiCache[seq] = analysis.copyWith(actionItems: items);
    notifyListeners();
  }

  // ===========================================================================
  // OPTIMISTIC MUTATIONS (STAR, READ, ARCHIVE, TRASH)
  // ===========================================================================

  /// Optimistically toggles the star (isFlagged) flag and syncs with /api/flags.
  Future<void> toggleStar(int seq, {String? folder}) async {
    final targetFolder = folder ?? _currentFolder.apiKey;
    final list = _folderEmailCache[targetFolder];
    if (list == null) return;

    final index = list.indexWhere((m) => m.seq == seq);
    if (index == -1) return;

    final original = list[index];
    final newFlagged = !original.flagged;

    // 1. Optimistic memory update
    list[index] = original.copyWith(flagged: newFlagged);
    if (_detailsCache.containsKey(seq)) {
      _detailsCache[seq] = _detailsCache[seq]!.copyWith(flagged: newFlagged);
    }
    notifyListeners();

    // 2. Network synchronization
    try {
      final success = await _apiService.toggleFlag(
        seq: seq,
        flagged: newFlagged,
        folder: targetFolder,
      );
      if (!success) throw Exception('API returned false for toggleFlag');
    } catch (e) {
      // 3. Rollback on failure
      list[index] = original;
      if (_detailsCache.containsKey(seq)) {
        _detailsCache[seq] =
            _detailsCache[seq]!.copyWith(flagged: original.flagged);
      }
      notifyListeners();
      debugPrint('toggleStar failed for seq $seq: $e. Rolled back.');
      rethrow;
    }
  }

  /// Optimistically toggles read/unread status and syncs with /api/flags.
  Future<void> toggleRead(int seq, {String? folder}) async {
    final targetFolder = folder ?? _currentFolder.apiKey;
    final list = _folderEmailCache[targetFolder];
    if (list == null) return;

    final index = list.indexWhere((m) => m.seq == seq);
    if (index == -1) return;

    final original = list[index];
    final newRead = !original.read;

    // 1. Optimistic memory update
    list[index] = original.copyWith(read: newRead);
    if (_detailsCache.containsKey(seq)) {
      _detailsCache[seq] = _detailsCache[seq]!.copyWith(read: newRead);
    }
    notifyListeners();

    // 2. Network synchronization
    try {
      final success = await _apiService.toggleFlag(
        seq: seq,
        seen: newRead,
        folder: targetFolder,
      );
      if (!success) throw Exception('API returned false for toggleFlag');
    } catch (e) {
      // 3. Rollback on failure
      list[index] = original;
      if (_detailsCache.containsKey(seq)) {
        _detailsCache[seq] =
            _detailsCache[seq]!.copyWith(read: original.read);
      }
      notifyListeners();
      debugPrint('toggleRead failed for seq $seq: $e. Rolled back.');
      rethrow;
    }
  }

  /// Convenience helper to mark an email as read if it is currently unread.
  Future<void> markAsRead(int seq, {String? folder}) async {
    final targetFolder = folder ?? _currentFolder.apiKey;
    final list = _folderEmailCache[targetFolder];
    if (list == null) return;

    final item =
        list.firstWhere((m) => m.seq == seq, orElse: () => list.first);
    if (!item.read) {
      await toggleRead(seq, folder: targetFolder);
    }
  }

  /// Optimistically moves email to Archive via POST /api/archive.
  Future<void> archiveEmail(int seq, {String? folder}) async {
    final targetFolder = folder ?? _currentFolder.apiKey;
    final list = _folderEmailCache[targetFolder];
    if (list == null) return;

    final index = list.indexWhere((m) => m.seq == seq);
    if (index == -1) return;

    final removedItem = list.removeAt(index);
    notifyListeners();

    try {
      final success = await _apiService.archiveEmail(seq, folder: targetFolder);
      if (!success) throw Exception('API returned false for archiveEmail');
    } catch (e) {
      // Rollback on failure
      list.insert(index, removedItem);
      notifyListeners();
      debugPrint('archiveEmail failed for seq $seq: $e. Rolled back.');
      rethrow;
    }
  }

  /// Optimistically moves email to Trash or permanently deletes via POST /api/trash.
  Future<void> trashEmail(
    int seq, {
    String? folder,
    bool permanent = false,
  }) async {
    final targetFolder = folder ?? _currentFolder.apiKey;
    final list = _folderEmailCache[targetFolder];
    if (list == null) return;

    final index = list.indexWhere((m) => m.seq == seq);
    if (index == -1) return;

    final isPermanent = permanent || targetFolder == 'trash';
    final removedItem = list.removeAt(index);
    notifyListeners();

    try {
      final success = await _apiService.trashEmail(
        seq,
        folder: targetFolder,
        permanent: isPermanent,
      );
      if (!success) throw Exception('API returned false for trashEmail');
    } catch (e) {
      // Rollback on failure
      list.insert(index, removedItem);
      notifyListeners();
      debugPrint('trashEmail failed for seq $seq: $e. Rolled back.');
      rethrow;
    }
  }

  // ===========================================================================
  // SEARCH & FILTERING CONTROLS
  // ===========================================================================

  /// Sets client-side search query and triggers UI re-render.
  void setSearchQuery(String query) {
    _searchQuery = query;
    notifyListeners();
  }

  /// Sets filter tab ('all' or 'unread') and triggers UI re-render.
  void setFilterTab(String tab) {
    if (_filterTab != tab) {
      _filterTab = tab;
      notifyListeners();
    }
  }

  /// Clears any transient error message.
  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }

  /// Resets all caches, active folder, and state (called on logout).
  void clearAll() {
    _folderEmailCache.clear();
    _detailsCache.clear();
    _aiCache.clear();
    _currentFolder = MailFolder.inbox;
    _isLoading = false;
    _isRefreshing = false;
    _errorMessage = null;
    _accountEmail = null;
    _searchQuery = '';
    _filterTab = 'all';
    notifyListeners();
  }

  // ===========================================================================
  // TESTING HELPERS
  // ===========================================================================

  /// Seeds email cache directly for fast, deterministic unit and widget testing.
  @visibleForTesting
  void seedEmailsForTesting(String folder, List<EmailSummary> seededEmails) {
    _folderEmailCache[folder] = List<EmailSummary>.from(seededEmails);
    _isLoading = false;
    _isRefreshing = false;
    _errorMessage = null;
    notifyListeners();
  }

  /// Clears email cache for testing empty states.
  @visibleForTesting
  void clearEmailsForTesting() {
    _folderEmailCache.clear();
    _isLoading = false;
    _isRefreshing = false;
    notifyListeners();
  }

  /// Injects an error message for testing error UI.
  @visibleForTesting
  void setErrorForTesting(String message) {
    _errorMessage = message;
    _isLoading = false;
    _isRefreshing = false;
    notifyListeners();
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  void _updateSummaryFlagInMemory(
    int seq,
    String folderKey, {
    bool? read,
    bool? flagged,
  }) {
    final list = _folderEmailCache[folderKey];
    if (list == null) return;

    final index = list.indexWhere((m) => m.seq == seq);
    if (index != -1) {
      list[index] = list[index].copyWith(
        read: read ?? list[index].read,
        flagged: flagged ?? list[index].flagged,
      );
    }
  }
}
