import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;

import '../models/user_session.dart';
import '../models/email_summary.dart';
import '../models/email_detail.dart';
import '../models/ai_analysis.dart';

class ApiException implements Exception {
  final int statusCode;
  final String message;
  final dynamic rawError;

  ApiException({
    required this.statusCode,
    required this.message,
    this.rawError,
  });

  @override
  String toString() => message;
}

class LoginUser {
  final String email;
  final String host;

  const LoginUser({required this.email, required this.host});

  factory LoginUser.fromJson(Map<String, dynamic> json) {
    return LoginUser(
      email: json['email'] as String? ?? '',
      host: json['host'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() => {'email': email, 'host': host};
}

class LoginResponse {
  final bool success;
  final String? token;
  final DateTime? expiresAt;
  final LoginUser? user;
  final String? error;
  final UserSession? session;

  const LoginResponse({
    required this.success,
    this.token,
    this.expiresAt,
    this.user,
    this.error,
    this.session,
  });

  String? get email => user?.email ?? session?.email;
  bool get isValid => success && (token != null && token!.isNotEmpty);
}

class ApiService {
  static const String defaultBaseUrl = 'http://192.168.178.20:4321';
  static const Duration timeoutDuration = Duration(seconds: 15);

  final http.Client _client;
  String _baseUrl;
  String? _authToken;

  ApiService({
    http.Client? client,
    String baseUrl = defaultBaseUrl,
    String? authToken,
  })  : _client = client ?? http.Client(),
        _baseUrl = _sanitizeUrl(baseUrl),
        _authToken = authToken;

  static String _sanitizeUrl(String url) {
    var sanitized = url.trim();
    while (sanitized.endsWith('/')) {
      sanitized = sanitized.substring(0, sanitized.length - 1);
    }
    return sanitized;
  }

  String get baseUrl => _baseUrl;
  void setBaseUrl(String url) => _baseUrl = _sanitizeUrl(url);

  String? get authToken => _authToken;
  void setAuthToken(String? token) => _authToken = token;
  void setToken(String? token) => setAuthToken(token);
  void clearToken() => setAuthToken(null);

  Map<String, String> _buildHeaders({bool includeAuth = true}) {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (includeAuth && _authToken != null && _authToken!.isNotEmpty) {
      headers['Authorization'] = 'Bearer $_authToken';
    }
    return headers;
  }

  String _mapErrorMessage(int statusCode, String? backendError) {
    switch (statusCode) {
      case 400:
        if (backendError != null &&
            backendError.contains('Missing required fields')) {
          return 'Bitte füllen Sie alle erforderlichen Felder aus (E-Mail, Passwort, Server).';
        } else if (backendError != null &&
            backendError.contains('Invalid port')) {
          return 'Ungültige Portnummer. Bitte einen Port zwischen 1 und 65535 angeben.';
        } else if (backendError != null &&
            backendError.contains('internal or private IP')) {
          return 'Verbindung zu internen oder privaten IP-Adressen ist nicht gestattet.';
        } else {
          return backendError ??
              'Ungültige Anfrage. Bitte überprüfen Sie Ihre Eingaben.';
        }
      case 401:
        if (backendError != null &&
            backendError.contains('IMAP authentication failed')) {
          return 'IMAP-Anmeldung fehlgeschlagen. Bitte prüfe E-Mail-Adresse, Passwort und Server-Einstellungen.';
        } else {
          return 'Sitzung abgelaufen oder ungültig. Bitte melden Sie sich erneut an.';
        }
      case 404:
        return backendError ??
            'Die angeforderte E-Mail konnte auf dem Server nicht gefunden werden.';
      case 429:
        return backendError ??
            'Zu viele Fehlversuche. Bitte warten Sie einen Moment vor dem nächsten Versuch.';
      case 502:
        return 'Verbindung zum IMAP-Mailserver fehlgeschlagen. Bitte Serveradresse und Port prüfen.';
      case 503:
        return 'Dienst vorübergehend nicht verfügbar. Bitte in wenigen Sekunden erneut versuchen.';
      case 500:
      default:
        return 'Interner Serverfehler aufgetreten. Bitte versuchen Sie es später erneut.';
    }
  }

  Never _handleError(http.Response response) {
    String? backendError;
    try {
      final body = jsonDecode(utf8.decode(response.bodyBytes));
      if (body is Map && body['error'] != null) {
        backendError = body['error'].toString();
      }
    } catch (_) {}

    final germanMessage = _mapErrorMessage(response.statusCode, backendError);

    throw ApiException(
      statusCode: response.statusCode,
      message: germanMessage,
      rawError: backendError,
    );
  }

  Future<T> _guardNetwork<T>(Future<T> Function() call) async {
    try {
      return await call().timeout(timeoutDuration);
    } on TimeoutException {
      throw ApiException(
        statusCode: 408,
        message:
            'Zeitüberschreitung bei der Anfrage. Der Server antwortet nicht rechtzeitig.',
      );
    } on SocketException {
      throw ApiException(
        statusCode: 0,
        message:
            'Keine Verbindung zum Dopis-Server möglich. Bitte Netzwerkverbindung und Server-URL prüfen.',
      );
    } on http.ClientException {
      throw ApiException(
        statusCode: 0,
        message:
            'Verbindungsfehler. Bitte überprüfen Sie Ihre Internetverbindung und die Server-URL.',
      );
    }
  }

  // --- Auth ---
  Future<LoginResponse> login({
    required String email,
    required String password,
    required String host,
    required int port,
    bool? secure,
  }) async {
    try {
      final uri = Uri.parse('$_baseUrl/api/auth/login');
      final payload = {
        'email': email.trim(),
        'password': password,
        'host': host.trim(),
        'port': port,
        'secure': secure ?? (port == 993),
      };

      final response = await _client
          .post(
            uri,
            headers: _buildHeaders(includeAuth: false),
            body: jsonEncode(payload),
          )
          .timeout(timeoutDuration);

      if (response.statusCode >= 200 && response.statusCode < 300) {
        final data =
            jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
        final token = data['token'] as String? ?? '';
        final expiresAtStr = data['expiresAt'] as String?;
        final expiresAt = expiresAtStr != null
            ? DateTime.tryParse(expiresAtStr) ??
                DateTime.now().add(const Duration(days: 14))
            : DateTime.now().add(const Duration(days: 14));

        final userMap = data['user'] as Map<String, dynamic>?;
        final loginUser = userMap != null
            ? LoginUser.fromJson(userMap)
            : LoginUser(email: email.trim(), host: host.trim());

        final session = UserSession(
          token: token,
          email: loginUser.email.isNotEmpty ? loginUser.email : email.trim(),
          host: loginUser.host.isNotEmpty ? loginUser.host : host.trim(),
          port: port,
          expiresAt: expiresAt,
        );

        _authToken = token;

        return LoginResponse(
          success: true,
          token: token,
          expiresAt: expiresAt,
          user: loginUser,
          session: session,
        );
      } else {
        String? backendError;
        try {
          final body = jsonDecode(utf8.decode(response.bodyBytes));
          if (body is Map && body['error'] != null) {
            backendError = body['error'].toString();
          }
        } catch (_) {}

        final germanMessage =
            _mapErrorMessage(response.statusCode, backendError);

        return LoginResponse(
          success: false,
          error: germanMessage,
        );
      }
    } on TimeoutException {
      return const LoginResponse(
        success: false,
        error:
            'Zeitüberschreitung bei der Anfrage. Der Server antwortet nicht rechtzeitig.',
      );
    } on SocketException {
      return const LoginResponse(
        success: false,
        error:
            'Keine Verbindung zum Dopis-Server möglich. Bitte Netzwerkverbindung und Server-URL prüfen.',
      );
    } on http.ClientException {
      return const LoginResponse(
        success: false,
        error:
            'Verbindungsfehler. Bitte überprüfen Sie Ihre Internetverbindung und die Server-URL.',
      );
    } catch (e) {
      return LoginResponse(
        success: false,
        error: 'Verbindungsfehler: $e',
      );
    }
  }

  // --- Emails ---
  Future<List<EmailSummary>> getEmails({String folder = 'inbox'}) async {
    return _guardNetwork(() async {
      final uri = Uri.parse('$_baseUrl/api/emails').replace(
        queryParameters: {'folder': folder},
      );

      final response = await _client.get(uri, headers: _buildHeaders());
      if (response.statusCode >= 200 && response.statusCode < 300) {
        final data = jsonDecode(utf8.decode(response.bodyBytes));
        List rawList = [];
        if (data is Map<String, dynamic>) {
          rawList = (data['emails'] as List?) ?? (data['msgs'] as List?) ?? [];
        } else if (data is List) {
          rawList = data;
        }
        return rawList
            .map((e) => EmailSummary.fromJson(e as Map<String, dynamic>))
            .toList();
      }

      _handleError(response);
    });
  }

  Future<EmailDetail> getEmail(int seq, {String folder = 'inbox'}) async {
    return _guardNetwork(() async {
      final uri = Uri.parse('$_baseUrl/api/email').replace(
        queryParameters: {
          'id': seq.toString(),
          'folder': folder,
        },
      );

      final response = await _client.get(uri, headers: _buildHeaders());
      if (response.statusCode >= 200 && response.statusCode < 300) {
        final data =
            jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
        return EmailDetail.fromJson(data);
      }

      _handleError(response);
    });
  }

  // --- Actions ---
  Future<bool> toggleFlag({
    required int seq,
    bool? seen,
    bool? flagged,
    String folder = 'inbox',
  }) async {
    return _guardNetwork(() async {
      final uri = Uri.parse('$_baseUrl/api/flags');
      final payload = <String, dynamic>{
        'seq': seq,
        'folder': folder,
      };
      if (seen != null) payload['seen'] = seen;
      if (flagged != null) payload['flagged'] = flagged;

      final response = await _client.post(
        uri,
        headers: _buildHeaders(),
        body: jsonEncode(payload),
      );

      if (response.statusCode >= 200 && response.statusCode < 300) {
        final data =
            jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
        return data['success'] == true;
      }

      _handleError(response);
    });
  }

  Future<bool> archiveEmail(int seq, {String folder = 'inbox'}) async {
    return _guardNetwork(() async {
      final uri = Uri.parse('$_baseUrl/api/archive');
      final payload = {'seq': seq, 'folder': folder};

      final response = await _client.post(
        uri,
        headers: _buildHeaders(),
        body: jsonEncode(payload),
      );

      if (response.statusCode >= 200 && response.statusCode < 300) {
        final data =
            jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
        return data['success'] == true;
      }

      _handleError(response);
    });
  }

  Future<bool> trashEmail(
    int seq, {
    String folder = 'inbox',
    bool permanent = false,
  }) async {
    return _guardNetwork(() async {
      final uri = Uri.parse('$_baseUrl/api/trash');
      final payload = {'seq': seq, 'folder': folder, 'permanent': permanent};

      final response = await _client.post(
        uri,
        headers: _buildHeaders(),
        body: jsonEncode(payload),
      );

      if (response.statusCode >= 200 && response.statusCode < 300) {
        final data =
            jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
        return data['success'] == true;
      }

      _handleError(response);
    });
  }

  // --- AI Analysis ---
  Future<AiAnalysisResult> analyzeEmail({
    String? subject,
    String? from,
    String? text,
    String? html,
  }) async {
    return _guardNetwork(() async {
      final uri = Uri.parse('$_baseUrl/api/ai/analyze');
      final payload = <String, dynamic>{};
      if (subject != null) payload['subject'] = subject;
      if (from != null) payload['from'] = from;
      if (text != null) payload['text'] = text;
      if (html != null) payload['html'] = html;

      final response = await _client.post(
        uri,
        headers: _buildHeaders(),
        body: jsonEncode(payload),
      );

      if (response.statusCode >= 200 && response.statusCode < 300) {
        final bodyString = utf8.decode(response.bodyBytes, allowMalformed: true);
        final data = jsonDecode(bodyString) as Map<String, dynamic>;
        return AiAnalysisResult.fromJson(data);
      }

      _handleError(response);
    });
  }
}
