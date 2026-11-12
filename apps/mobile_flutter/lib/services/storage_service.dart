import 'package:shared_preferences/shared_preferences.dart';
import '../models/user_session.dart';

class StorageService {
  static const String keyAuthToken = 'dopis_auth_token';
  static const String keyUserEmail = 'dopis_user_email';
  static const String keyImapHost = 'dopis_imap_host';
  static const String keyImapPort = 'dopis_imap_port';
  static const String keyExpiresAt = 'dopis_expires_at';
  static const String keyCustomBaseUrl = 'dopis_custom_base_url';

  final SharedPreferences? _injectedPrefs;

  StorageService([this._injectedPrefs]);

  Future<SharedPreferences> _getPrefs() async {
    return _injectedPrefs ?? await SharedPreferences.getInstance();
  }

  Future<void> saveSession(UserSession session) async {
    final prefs = await _getPrefs();
    await prefs.setString(keyAuthToken, session.token);
    await prefs.setString(keyUserEmail, session.email);
    await prefs.setString(keyImapHost, session.host);
    await prefs.setInt(keyImapPort, session.port);
    await prefs.setString(keyExpiresAt, session.expiresAt.toIso8601String());
  }

  Future<UserSession?> getSession() async {
    final prefs = await _getPrefs();
    final token = prefs.getString(keyAuthToken);
    final email = prefs.getString(keyUserEmail);
    final host = prefs.getString(keyImapHost);
    final port = prefs.getInt(keyImapPort) ?? 993;
    final expiresAtStr = prefs.getString(keyExpiresAt);

    if (token == null || token.isEmpty || email == null || host == null) {
      return null;
    }

    final expiresAt = expiresAtStr != null
        ? DateTime.tryParse(expiresAtStr) ?? DateTime.now()
        : DateTime.now();

    final session = UserSession(
      token: token,
      email: email,
      host: host,
      port: port,
      expiresAt: expiresAt,
    );

    if (session.isExpired) {
      await clearSession();
      return null;
    }

    return session;
  }

  /// Alias for getSession() for consistency with load/save naming conventions.
  Future<UserSession?> loadSession() => getSession();

  Future<void> clearSession() async {
    final prefs = await _getPrefs();
    await prefs.remove(keyAuthToken);
    await prefs.remove(keyUserEmail);
    await prefs.remove(keyImapHost);
    await prefs.remove(keyImapPort);
    await prefs.remove(keyExpiresAt);
    // Preserves keyCustomBaseUrl across session logouts
  }

  Future<String?> getCustomBaseUrl() async {
    final prefs = await _getPrefs();
    final url = prefs.getString(keyCustomBaseUrl);
    if (url != null && url.trim().isNotEmpty) {
      return url.trim();
    }
    return null;
  }

  Future<void> setCustomBaseUrl(String url) async {
    final prefs = await _getPrefs();
    final trimmed = url.trim();
    if (trimmed.isEmpty) {
      await prefs.remove(keyCustomBaseUrl);
    } else {
      await prefs.setString(keyCustomBaseUrl, trimmed);
    }
  }

  Future<void> clearAll() async {
    final prefs = await _getPrefs();
    await prefs.clear();
  }
}
