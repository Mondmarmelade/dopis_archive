import 'package:flutter/foundation.dart';
import '../models/user_session.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';

/// Manages authentication state, user session, and backend connectivity.
class AuthProvider extends ChangeNotifier {
  final ApiService _apiService;
  final StorageService _storageService;

  UserSession? _session;
  bool _isLoading = false;
  String? _errorMessage;
  String _baseUrl = ApiService.defaultBaseUrl;

  AuthProvider({
    ApiService? apiService,
    StorageService? storageService,
  })  : _apiService = apiService ?? ApiService(),
        _storageService = storageService ?? StorageService() {
    _initBaseUrl();
  }

  // --- Getters ---
  bool get isAuthenticated => _session != null && !_session!.isExpired;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  UserSession? get session => _session;
  String get baseUrl => _baseUrl;
  String? get userEmail => _session?.email;

  // --- Initialization ---
  Future<void> _initBaseUrl() async {
    try {
      final storedUrl = await _storageService.getCustomBaseUrl();
      if (storedUrl != null && storedUrl.isNotEmpty) {
        _baseUrl = storedUrl;
        _apiService.setBaseUrl(_baseUrl);
        notifyListeners();
      }
    } catch (e) {
      debugPrint('AuthProvider _initBaseUrl failed: $e');
    }
  }

  /// Attempts auto-login using saved session in local storage.
  Future<bool> tryAutoLogin() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final storedUrl = await _storageService.getCustomBaseUrl();
      if (storedUrl != null && storedUrl.isNotEmpty) {
        _baseUrl = storedUrl;
        _apiService.setBaseUrl(_baseUrl);
      }

      final savedSession = await _storageService.getSession();
      if (savedSession != null && !savedSession.isExpired) {
        _session = savedSession;
        _apiService.setToken(savedSession.token);
        _isLoading = false;
        notifyListeners();
        return true;
      } else if (savedSession != null && savedSession.isExpired) {
        await _storageService.clearSession();
      }
    } catch (e) {
      debugPrint('tryAutoLogin error: $e');
    }

    _session = null;
    _isLoading = false;
    notifyListeners();
    return false;
  }

  /// Authenticates credentials against POST /api/auth/login.
  Future<bool> login({
    required String email,
    required String password,
    required String host,
    required int port,
    bool? secure,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final cleanEmail = email.trim();
      final cleanHost = host.trim();

      if (cleanEmail.isEmpty || password.isEmpty || cleanHost.isEmpty) {
        _errorMessage = 'Bitte alle Pflichtfelder ausfüllen.';
        _isLoading = false;
        notifyListeners();
        return false;
      }

      final result = await _apiService.login(
        email: cleanEmail,
        password: password,
        host: cleanHost,
        port: port,
        secure: secure ?? (port == 993),
      );

      if (result.success && result.token != null) {
        final newSession = result.session ??
            UserSession(
              token: result.token!,
              email: result.user?.email ?? cleanEmail,
              host: result.user?.host ?? cleanHost,
              port: port,
              expiresAt: result.expiresAt ??
                  DateTime.now().add(const Duration(days: 14)),
            );

        await _storageService.saveSession(newSession);
        _session = newSession;
        _apiService.setToken(newSession.token);
        _errorMessage = null;
        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        _errorMessage = result.error ??
            'IMAP-Anmeldung fehlgeschlagen. Bitte prüfe E-Mail-Adresse, Passwort und Server-Einstellungen.';
        _isLoading = false;
        notifyListeners();
        return false;
      }
    } catch (e) {
      _errorMessage =
          'Verbindung zum Server fehlgeschlagen. Bitte prüfe die Server-URL.';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Logs out the user, invalidating session in storage.
  Future<void> logout() async {
    _session = null;
    _errorMessage = null;
    _apiService.clearToken();
    try {
      await _storageService.clearSession();
    } catch (e) {
      debugPrint('logout clearSession error: $e');
    }
    notifyListeners();
  }

  /// Updates backend base URL and persists change.
  Future<void> setBaseUrl(String newUrl) async {
    var sanitized = newUrl.trim();
    if (sanitized.endsWith('/')) {
      sanitized = sanitized.substring(0, sanitized.length - 1);
    }
    if (sanitized.isNotEmpty) {
      _baseUrl = sanitized;
      _apiService.setBaseUrl(sanitized);
      await _storageService.setCustomBaseUrl(sanitized);
      notifyListeners();
    }
  }

  /// Clears active error banner message.
  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }

  /// Sets session directly for fast deterministic testing.
  @visibleForTesting
  void setSessionForTesting(UserSession? session) {
    _session = session;
    if (session != null) {
      _apiService.setToken(session.token);
    } else {
      _apiService.clearToken();
    }
    notifyListeners();
  }
}
