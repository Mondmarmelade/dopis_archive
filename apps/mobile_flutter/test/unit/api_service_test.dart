import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:dopis_mobile/services/api_service.dart';

void main() {
  group('ApiService Auth Contracts', () {
    test('login returns token and sets authToken on HTTP 200', () async {
      final mockClient = MockClient((request) async {
        expect(request.url.path, '/api/auth/login');
        expect(request.method, 'POST');
        final body = jsonDecode(request.body);
        expect(body['email'], 'user@domain.de');
        expect(body['password'], 'secretPassword');
        expect(body['host'], 'imap.ionos.de');
        expect(body['port'], 993);

        return http.Response(
          jsonEncode({
            'success': true,
            'token': 'encrypted-token-xyz',
            'expiresAt': '2026-09-17T12:00:00.000Z',
            'user': {'email': 'user@domain.de', 'host': 'imap.ionos.de'},
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final api =
          ApiService(client: mockClient, baseUrl: 'http://localhost:4321');
      final result = await api.login(
        email: 'user@domain.de',
        password: 'secretPassword',
        host: 'imap.ionos.de',
        port: 993,
        secure: true,
      );

      expect(result.success, isTrue);
      expect(result.token, 'encrypted-token-xyz');
      expect(result.user?.email, 'user@domain.de');
      expect(api.authToken, 'encrypted-token-xyz');
    });

    test('login maps HTTP 401 to authentic German error message', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'error':
                'IMAP authentication failed. Please verify your email, password, and host.'
          }),
          401,
          headers: {'content-type': 'application/json'},
        );
      });

      final api =
          ApiService(client: mockClient, baseUrl: 'http://localhost:4321');
      final result = await api.login(
        email: 'wrong@domain.de',
        password: 'wrong',
        host: 'imap.ionos.de',
        port: 993,
      );

      expect(result.success, isFalse);
      expect(result.error, contains('IMAP-Anmeldung fehlgeschlagen'));
    });

    test('login maps HTTP 429 rate limit message', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'error':
                'Zu viele Fehlversuche. Bitte warten Sie 30 Sekunden vor dem nächsten Versuch.'
          }),
          429,
          headers: {'content-type': 'application/json'},
        );
      });

      final api =
          ApiService(client: mockClient, baseUrl: 'http://localhost:4321');
      final result = await api.login(
        email: 'locked@domain.de',
        password: 'pass',
        host: 'imap.ionos.de',
        port: 993,
      );

      expect(result.success, isFalse);
      expect(result.error, contains('Zu viele Fehlversuche'));
    });

    test('login maps HTTP 400 bad request error messages', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'error':
                'Missing required fields: email, password, host are required.'
          }),
          400,
          headers: {'content-type': 'application/json'},
        );
      });

      final api =
          ApiService(client: mockClient, baseUrl: 'http://localhost:4321');
      final result = await api.login(
        email: '',
        password: '',
        host: '',
        port: 993,
      );

      expect(result.success, isFalse);
      expect(result.error, contains('Bitte füllen Sie alle erforderlichen Felder aus'));
    });

    test('login handles connection failure gracefully', () async {
      final mockClient = MockClient((request) async {
        throw const SocketException('Connection refused');
      });

      final api =
          ApiService(client: mockClient, baseUrl: 'http://unreachable:4321');
      final result = await api.login(
        email: 'test@dopis.de',
        password: 'pwd',
        host: 'imap.dopis.de',
        port: 993,
      );

      expect(result.success, isFalse);
      expect(result.error, contains('Keine Verbindung zum Dopis-Server möglich'));
    });
  });

  group('ApiService Email Endpoints & Bearer Authentication', () {
    test('getEmails attaches Bearer token header and parses list', () async {
      final mockClient = MockClient((request) async {
        expect(request.url.path, '/api/emails');
        expect(request.url.queryParameters['folder'], 'inbox');
        expect(request.headers['Authorization'], 'Bearer auth-token-777');

        return http.Response(
          jsonEncode({
            'account': 'user@domain.de',
            'folder': 'inbox',
            'emails': [
              {
                'id': '1',
                'seq': 1,
                'uid': 101,
                'name': 'Sender Name',
                'email': 'sender@domain.de',
                'subject': 'Test Betreff',
                'date': '2026-09-03T12:00:00.000Z',
                'read': false,
                'flagged': false,
              }
            ],
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final api = ApiService(
        client: mockClient,
        baseUrl: 'http://localhost:4321',
        authToken: 'auth-token-777',
      );

      final emails = await api.getEmails(folder: 'inbox');
      expect(emails.length, 1);
      expect(emails.first.seq, 1);
      expect(emails.first.subject, 'Test Betreff');
      expect(emails.first.isUnread, isTrue);
    });

    test('getEmail fetches email detail by sequence', () async {
      final mockClient = MockClient((request) async {
        expect(request.url.path, '/api/email');
        expect(request.url.queryParameters['id'], '42');

        return http.Response(
          jsonEncode({
            'id': '42',
            'seq': 42,
            'uid': 1042,
            'subject': 'Detail Betreff',
            'from': {'name': 'Team', 'address': 'team@domain.de'},
            'to': [],
            'cc': [],
            'date': '2026-09-03T12:00:00.000Z',
            'html': '<p>Inhalt</p>',
            'text': 'Inhalt',
            'attachments': [],
            'flags': [],
            'read': true,
            'flagged': false,
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final api = ApiService(
        client: mockClient,
        baseUrl: 'http://localhost:4321',
        authToken: 'tok',
      );

      final detail = await api.getEmail(42);
      expect(detail.seq, 42);
      expect(detail.subject, 'Detail Betreff');
      expect(detail.text, 'Inhalt');
    });

    test('toggleFlag calls /api/flags with payload', () async {
      final mockClient = MockClient((request) async {
        expect(request.url.path, '/api/flags');
        final body = jsonDecode(request.body);
        expect(body['seq'], 5);
        expect(body['seen'], true);
        return http.Response(jsonEncode({'success': true}), 200);
      });

      final api = ApiService(client: mockClient);
      final success = await api.toggleFlag(seq: 5, seen: true);
      expect(success, isTrue);
    });

    test('analyzeEmail calls /api/ai/analyze and returns result', () async {
      final mockClient = MockClient((request) async {
        expect(request.url.path, '/api/ai/analyze');
        return http.Response(
          jsonEncode({
            'summary': ['Wichtige Mitteilung'],
            'category': 'Geschäftlich',
            'tags': ['Dringend'],
            'actionItems': [
              {'task': 'Antworten', 'due': '2026-09-05'}
            ],
          }),
          200,
        );
      });

      final api = ApiService(client: mockClient);
      final analysis = await api.analyzeEmail(subject: 'Wichtig', text: 'Text');
      expect(analysis.category, 'Geschäftlich');
      expect(analysis.summary.first, 'Wichtige Mitteilung');
      expect(analysis.actionItems.length, 1);
    });
  });
}
