import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:dopis_mobile/models/user_session.dart';
import 'package:dopis_mobile/models/email_summary.dart';
import 'package:dopis_mobile/models/email_detail.dart';
import 'package:dopis_mobile/models/ai_analysis.dart';
import 'package:dopis_mobile/services/storage_service.dart';
import 'package:dopis_mobile/services/api_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  // ===========================================================================
  // 1. DATA MODELS ADVERSARIAL STRESS-TESTS
  // ===========================================================================

  group('Adversarial Challenge: UserSession Model', () {
    test('handles completely empty JSON payload with default values', () {
      final session = UserSession.fromJson({});
      expect(session.token, '');
      expect(session.email, '');
      expect(session.host, '');
      expect(session.port, 993);
      expect(session.isExpired, isFalse);
      expect(session.isValid, isFalse); // token is empty
    });

    test('handles null fields without throwing exceptions', () {
      final session = UserSession.fromJson({
        'token': null,
        'email': null,
        'host': null,
        'port': null,
        'expiresAt': null,
      });
      expect(session.token, '');
      expect(session.email, '');
      expect(session.host, '');
      expect(session.port, 993);
      expect(session.isExpired, isFalse);
      expect(session.isValid, isFalse);
    });

    test('handles invalid/malformed date formats safely with fallback', () {
      final session = UserSession.fromJson({
        'token': 'valid-tok',
        'expiresAt': 'THIS_IS_NOT_A_DATE',
      });
      expect(session.token, 'valid-tok');
      // Falls back to DateTime.now() + 14 days
      expect(session.isExpired, isFalse);
      expect(session.isValid, isTrue);
    });

    test('correctly identifies expired vs active sessions', () {
      final pastSession = UserSession(
        token: 'past',
        email: 'test@ionos.de',
        host: 'imap.ionos.de',
        port: 993,
        expiresAt: DateTime.now().subtract(const Duration(seconds: 10)),
      );
      expect(pastSession.isExpired, isTrue);
      expect(pastSession.isValid, isFalse);

      final futureSession = UserSession(
        token: 'future',
        email: 'test@ionos.de',
        host: 'imap.ionos.de',
        port: 993,
        expiresAt: DateTime.now().add(const Duration(seconds: 10)),
      );
      expect(futureSession.isExpired, isFalse);
      expect(futureSession.isValid, isTrue);
    });

    test('fromLoginResponse handles missing user map and default host', () {
      final session = UserSession.fromLoginResponse(
        {
          'token': 'tok-abc',
          'expiresAt': '2026-12-31T23:59:59.000Z',
          'user': null,
        },
        port: 143,
        defaultHost: 'mail.example.com',
      );
      expect(session.token, 'tok-abc');
      expect(session.email, '');
      expect(session.host, 'mail.example.com');
      expect(session.port, 143);
      expect(session.isExpired, isFalse);
      expect(session.isValid, isTrue);
    });

    test('equality and hashCode contracts hold for identical data', () {
      final exp = DateTime.parse('2026-10-01T12:00:00.000Z');
      final s1 = UserSession(
        token: 'tok',
        email: 'a@b.c',
        host: 'imap.host.de',
        port: 993,
        expiresAt: exp,
      );
      final s2 = UserSession(
        token: 'tok',
        email: 'a@b.c',
        host: 'imap.host.de',
        port: 993,
        expiresAt: exp,
      );
      expect(s1, equals(s2));
      expect(s1.hashCode, equals(s2.hashCode));
    });
  });

  group('Adversarial Challenge: EmailSummary Model', () {
    test('handles completely empty JSON gracefully without crash', () {
      final summary = EmailSummary.fromJson({});
      expect(summary.id, '0');
      expect(summary.seq, 0);
      expect(summary.uid, 0);
      expect(summary.name, 'Unbekannt');
      expect(summary.email, '');
      expect(summary.subject, '(Kein Betreff)');
      expect(summary.read, isFalse);
      expect(summary.isUnread, isTrue);
      expect(summary.flagged, isFalse);
      expect(summary.isFlagged, isFalse);
      expect(summary.flags, isEmpty);
      expect(summary.snippet, isNull);
    });

    test('coerces string sequence numbers and string UIDs', () {
      final summary = EmailSummary.fromJson({
        'seq': '987',
        'uid': '654321',
      });
      expect(summary.seq, 987);
      expect(summary.uid, 654321);
      expect(summary.id, '987');
    });

    test('resolves seq from id if seq is missing', () {
      final summary = EmailSummary.fromJson({
        'id': '555',
      });
      expect(summary.seq, 555);
      expect(summary.uid, 555);
      expect(summary.id, '555');
    });

    test('handles negative, zero, or unparseable seq numbers safely', () {
      final summary = EmailSummary.fromJson({
        'seq': 'NOT_A_NUMBER',
        'id': 'ALSO_NOT_NUMBER',
      });
      expect(summary.seq, 0);
      expect(summary.uid, 0);
      expect(summary.id, 'ALSO_NOT_NUMBER');
    });

    test('resolves sender name hierarchy across all variations', () {
      // 1. Direct 'name' takes highest priority
      final s1 = EmailSummary.fromJson({
        'name': 'Direct Name',
        'from': {'name': 'From Name', 'address': 'from@d.de'},
        'email': 'direct@d.de',
      });
      expect(s1.senderName, 'Direct Name');
      expect(s1.fromAddress, 'direct@d.de');

      // 2. Fallback to from.name
      final s2 = EmailSummary.fromJson({
        'from': {'name': 'From Name', 'address': 'from@d.de'},
      });
      expect(s2.senderName, 'From Name');
      expect(s2.fromAddress, 'from@d.de');

      // 3. Fallback to email when name is empty string
      final s3 = EmailSummary.fromJson({
        'name': '   ',
        'email': 'sender@test.de',
      });
      expect(s3.senderName, 'sender@test.de');
      expect(s3.fromAddress, 'sender@test.de');

      // 4. Fallback to 'Unbekannt' when everything is missing
      final s4 = EmailSummary.fromJson({});
      expect(s4.senderName, 'Unbekannt');
      expect(s4.fromAddress, '');
    });

    test('resolves read vs unread boolean flag permutations', () {
      // Direct read: true
      final s1 = EmailSummary.fromJson({'read': true});
      expect(s1.read, isTrue);
      expect(s1.isUnread, isFalse);

      // Direct read: false
      final s2 = EmailSummary.fromJson({'read': false});
      expect(s2.read, isFalse);
      expect(s2.isUnread, isTrue);

      // isUnread: true (Astro backend format)
      final s3 = EmailSummary.fromJson({'isUnread': true});
      expect(s3.read, isFalse);
      expect(s3.isUnread, isTrue);

      // isUnread: false
      final s4 = EmailSummary.fromJson({'isUnread': false});
      expect(s4.read, isTrue);
      expect(s4.isUnread, isFalse);
    });

    test('resolves flagged vs isFlagged variations', () {
      final s1 = EmailSummary.fromJson({'flagged': true});
      expect(s1.isFlagged, isTrue);

      final s2 = EmailSummary.fromJson({'isFlagged': true});
      expect(s2.isFlagged, isTrue);

      final s3 = EmailSummary.fromJson({'flagged': false, 'isFlagged': true});
      expect(s3.isFlagged, isFalse); // flagged takes precedence
    });

    test('handles whitespace-only or null subjects', () {
      final s1 = EmailSummary.fromJson({'subject': '   '});
      expect(s1.subject, '(Kein Betreff)');

      final s2 = EmailSummary.fromJson({'subject': null});
      expect(s2.subject, '(Kein Betreff)');

      final s3 = EmailSummary.fromJson({'subject': 'Reales Thema'});
      expect(s3.subject, 'Reales Thema');
    });

    test('handles invalid date strings without crashing', () {
      final s = EmailSummary.fromJson({'date': 'MALFORMED_TIMESTAMP'});
      expect(s.date, isNotNull);
      // Fallback is DateTime.now()
      expect(DateTime.now().difference(s.date).inSeconds.abs(), lessThan(5));
    });

    test('handles mixed types in flags list safely', () {
      final s = EmailSummary.fromJson({
        'flags': [r'\Seen', 123, true, r'\Flagged'],
      });
      expect(s.flags, contains(r'\Seen'));
      expect(s.flags, contains('123'));
      expect(s.flags, contains('true'));
      expect(s.flags, contains(r'\Flagged'));
    });
  });

  group('Adversarial Challenge: EmailDetail Model', () {
    test('handles completely empty JSON payload without crash', () {
      final detail = EmailDetail.fromJson({});
      expect(detail.id, '0');
      expect(detail.seq, 0);
      expect(detail.uid, 0);
      expect(detail.subject, '(Kein Betreff)');
      expect(detail.name, '');
      expect(detail.email, '');
      expect(detail.to, isEmpty);
      expect(detail.cc, isEmpty);
      expect(detail.attachments, isEmpty);
      expect(detail.flags, isEmpty);
      expect(detail.read, isFalse);
      expect(detail.flagged, isFalse);
      expect(detail.hasHtml, isFalse);
      expect(detail.hasText, isFalse);
      expect(detail.hasAttachments, isFalse);
    });

    test('handles recipients list with missing names/addresses', () {
      final detail = EmailDetail.fromJson({
        'to': [
          {'name': 'Alice', 'address': 'alice@domain.de'},
          {'email': 'bob@domain.de'},
          {},
        ],
        'cc': [
          {'name': 'Charlie', 'email': 'charlie@domain.de'},
        ],
      });

      expect(detail.to.length, 3);
      expect(detail.to[0].name, 'Alice');
      expect(detail.to[0].address, 'alice@domain.de');
      expect(detail.to[1].address, 'bob@domain.de');
      expect(detail.to[2].name, '');
      expect(detail.to[2].address, '');

      expect(detail.cc.length, 1);
      expect(detail.cc[0].name, 'Charlie');
      expect(detail.cc[0].address, 'charlie@domain.de');
    });

    test('Attachment size formatting edge cases', () {
      const att0 = EmailAttachment(
        filename: 'zero.dat',
        mimeType: 'application/octet-stream',
        disposition: 'attachment',
        size: 0,
      );
      expect(att0.formattedSize, '0 B');

      const attSmall = EmailAttachment(
        filename: 'small.txt',
        mimeType: 'text/plain',
        disposition: 'attachment',
        size: 512,
      );
      expect(attSmall.formattedSize, '512 B');

      const att1Kb = EmailAttachment(
        filename: '1kb.txt',
        mimeType: 'text/plain',
        disposition: 'attachment',
        size: 1024,
      );
      expect(att1Kb.formattedSize, '1.0 KB');

      const att1Mb = EmailAttachment(
        filename: '1mb.bin',
        mimeType: 'application/octet-stream',
        disposition: 'attachment',
        size: 1048576,
      );
      expect(att1Mb.formattedSize, '1.0 MB');

      const attMultiMb = EmailAttachment(
        filename: 'video.mp4',
        mimeType: 'video/mp4',
        disposition: 'attachment',
        size: 15728640,
      );
      expect(attMultiMb.formattedSize, '15.0 MB');
    });

    test('hasHtml and hasText correctly detect whitespace-only bodies', () {
      final d1 = EmailDetail.fromJson({
        'html': '   \n\t  ',
        'text': '   ',
      });
      expect(d1.hasHtml, isFalse);
      expect(d1.hasText, isFalse);

      final d2 = EmailDetail.fromJson({
        'html': '<p>Hallo</p>',
        'text': 'Hallo',
      });
      expect(d2.hasHtml, isTrue);
      expect(d2.hasText, isTrue);
    });
  });

  group('Adversarial Challenge: AiAnalysisResult Model', () {
    test('handles completely empty JSON payload without crash', () {
      final result = AiAnalysisResult.fromJson({});
      expect(result.summary, isEmpty);
      expect(result.category, 'Sonstiges');
      expect(result.tags, isEmpty);
      expect(result.actionItems, isEmpty);
      expect(result.paymentInfo, isNull);
      expect(result.orderInfo, isNull);
    });

    test('handles summary as single string vs list of strings', () {
      // Single string summary
      final r1 = AiAnalysisResult.fromJson({
        'summary': 'Dies ist eine einzelne Zusammenfassung.',
      });
      expect(r1.summary.length, 1);
      expect(r1.summary.first, 'Dies ist eine einzelne Zusammenfassung.');

      // Array summary
      final r2 = AiAnalysisResult.fromJson({
        'summary': ['Punkt 1', 'Punkt 2', 'Punkt 3'],
      });
      expect(r2.summary.length, 3);
      expect(r2.summary[1], 'Punkt 2');
    });

    test('ActionItem toggling and null due dates', () {
      final item = ActionItem.fromJson({
        'task': 'Antwort an Chef senden',
        'due': null,
        'completed': false,
      });
      expect(item.task, 'Antwort an Chef senden');
      expect(item.due, isNull);
      expect(item.completed, isFalse);

      final completed = item.copyWith(completed: true);
      expect(completed.completed, isTrue);
      expect(completed.task, item.task);
      expect(completed.due, isNull);
    });

    test('PaymentInfo and OrderInfo deep parsing', () {
      final result = AiAnalysisResult.fromJson({
        'category': 'Rechnung',
        'paymentInfo': {
          'isPaymentReceipt': true,
          'provider': 'Klarna',
          'amount': '129,00 €',
        },
        'orderInfo': {
          'isOrder': true,
          'merchant': 'Zalando SE',
          'carrier': 'DHL',
          'stage': 'shipped',
        },
      });

      expect(result.paymentInfo, isNotNull);
      expect(result.paymentInfo!.isPaymentReceipt, isTrue);
      expect(result.paymentInfo!.provider, 'Klarna');
      expect(result.paymentInfo!.amount, '129,00 €');

      expect(result.orderInfo, isNotNull);
      expect(result.orderInfo!.isOrder, isTrue);
      expect(result.orderInfo!.merchant, 'Zalando SE');
      expect(result.orderInfo!.carrier, 'DHL');
      expect(result.orderInfo!.stage, 'shipped');
    });
  });

  // ===========================================================================
  // 2. STORAGE SERVICE STRESS-TESTS
  // ===========================================================================

  group('Adversarial Challenge: StorageService', () {
    late StorageService storage;

    setUp(() {
      SharedPreferences.setMockInitialValues({});
      storage = StorageService();
    });

    test('purges expired session and returns null on getSession()', () async {
      final expired = UserSession(
        token: 'token-expired',
        email: 'exp@domain.de',
        host: 'imap.domain.de',
        port: 993,
        expiresAt: DateTime.now().subtract(const Duration(minutes: 5)),
      );
      await storage.saveSession(expired);

      // First call discovers expiration, calls clearSession, returns null
      final s1 = await storage.getSession();
      expect(s1, isNull);

      // Subsequent call verifies storage was wiped
      final s2 = await storage.getSession();
      expect(s2, isNull);
    });

    test('clearSession strictly preserves custom base URL', () async {
      await storage.setCustomBaseUrl('http://192.168.178.20:4321');

      final session = UserSession(
        token: 'active-token-999',
        email: 'user@ionos.de',
        host: 'imap.ionos.de',
        port: 993,
        expiresAt: DateTime.now().add(const Duration(days: 10)),
      );
      await storage.saveSession(session);

      // User logs out / clearSession called
      await storage.clearSession();

      // Session must be purged
      final retrievedSession = await storage.getSession();
      expect(retrievedSession, isNull);

      // Custom base URL must remain intact
      final retrievedUrl = await storage.getCustomBaseUrl();
      expect(retrievedUrl, 'http://192.168.178.20:4321');
    });

    test('setCustomBaseUrl handles trailing whitespace and empty strings',
        () async {
      await storage.setCustomBaseUrl('   http://10.0.2.2:4321   ');
      expect(await storage.getCustomBaseUrl(), 'http://10.0.2.2:4321');

      // Empty string wipes custom setting, returning null
      await storage.setCustomBaseUrl('   ');
      expect(await storage.getCustomBaseUrl(), isNull);
    });

    test('getSession returns null when token or host is missing in storage',
        () async {
      final prefs = await SharedPreferences.getInstance();
      // Only email set, no token or host
      await prefs.setString(StorageService.keyUserEmail, 'lonely@test.de');

      final session = await storage.getSession();
      expect(session, isNull);
    });
  });

  // ===========================================================================
  // 3. API SERVICE HTTP & NETWORK STRESS-TESTS
  // ===========================================================================

  group('Adversarial Challenge: ApiService Error Resilience', () {
    test('login handles HTTP 400 with invalid port message', () async {
      final client = MockClient((request) async {
        return http.Response(
          jsonEncode({'error': 'Invalid port: must be between 1 and 65535.'}),
          400,
          headers: {'content-type': 'application/json'},
        );
      });

      final api = ApiService(client: client);
      final resp = await api.login(
        email: 'a@b.de',
        password: 'pass',
        host: 'imap.test.de',
        port: 99999,
      );

      expect(resp.success, isFalse);
      expect(resp.error, contains('Ungültige Portnummer'));
    });

    test('login handles HTTP 400 with private IP protection message',
        () async {
      final client = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'error':
                'Target host resolves to an internal or private IP address: 127.0.0.1'
          }),
          400,
          headers: {'content-type': 'application/json'},
        );
      });

      final api = ApiService(client: client);
      final resp = await api.login(
        email: 'a@b.de',
        password: 'pass',
        host: '127.0.0.1',
        port: 993,
      );

      expect(resp.success, isFalse);
      expect(resp.error, contains('Verbindung zu internen oder privaten IP-Adressen'));
    });

    test('login handles HTTP 401 IMAP credentials rejection', () async {
      final client = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'error':
                'IMAP authentication failed. Please verify your email, password, and host.'
          }),
          401,
          headers: {'content-type': 'application/json'},
        );
      });

      final api = ApiService(client: client);
      final resp = await api.login(
        email: 'bad@ionos.de',
        password: 'wrongpassword',
        host: 'imap.ionos.de',
        port: 993,
      );

      expect(resp.success, isFalse);
      expect(resp.error, contains('IMAP-Anmeldung fehlgeschlagen'));
    });

    test('login handles HTTP 429 rate limiting with German retry warning',
        () async {
      final client = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'error':
                'Zu viele Fehlversuche. Bitte warten Sie 300 Sekunden vor dem nächsten Versuch.'
          }),
          429,
          headers: {'content-type': 'application/json'},
        );
      });

      final api = ApiService(client: client);
      final resp = await api.login(
        email: 'locked@ionos.de',
        password: 'pwd',
        host: 'imap.ionos.de',
        port: 993,
      );

      expect(resp.success, isFalse);
      expect(resp.error, contains('Zu viele Fehlversuche'));
    });

    test('login handles HTTP 500 server error', () async {
      final client = MockClient((request) async {
        return http.Response(
          'Internal Server Error (Crash in worker)',
          500,
        );
      });

      final api = ApiService(client: client);
      final resp = await api.login(
        email: 'test@ionos.de',
        password: 'pwd',
        host: 'imap.ionos.de',
        port: 993,
      );

      expect(resp.success, isFalse);
      expect(resp.error, contains('Interner Serverfehler aufgetreten'));
    });

    test('login handles SocketException without unhandled throw', () async {
      final client = MockClient((request) async {
        throw const SocketException('Network is unreachable (OS Error 101)');
      });

      final api = ApiService(client: client);
      final resp = await api.login(
        email: 'test@ionos.de',
        password: 'pwd',
        host: 'imap.ionos.de',
        port: 993,
      );

      expect(resp.success, isFalse);
      expect(resp.error, contains('Keine Verbindung zum Dopis-Server möglich'));
    });

    test('login handles ClientException without unhandled throw', () async {
      final client = MockClient((request) async {
        throw http.ClientException('XMLHttpRequest error');
      });

      final api = ApiService(client: client);
      final resp = await api.login(
        email: 'test@ionos.de',
        password: 'pwd',
        host: 'imap.ionos.de',
        port: 993,
      );

      expect(resp.success, isFalse);
      expect(resp.error, contains('Verbindungsfehler'));
    });

    test('getEmails throws ApiException on HTTP 401 with mapped German message',
        () async {
      final client = MockClient((request) async {
        return http.Response(
          jsonEncode({'error': 'Unauthorized'}),
          401,
          headers: {'content-type': 'application/json'},
        );
      });

      final api = ApiService(client: client, authToken: 'bad-token');
      expect(
        () => api.getEmails(folder: 'inbox'),
        throwsA(isA<ApiException>().having(
          (e) => e.statusCode,
          'statusCode',
          401,
        )),
      );
    });

    test('getEmail throws ApiException on HTTP 404', () async {
      final client = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'error':
                'E-Mail (Seq 999) konnte auf dem Server nicht gefunden werden.'
          }),
          404,
          headers: {'content-type': 'application/json'},
        );
      });

      final api = ApiService(client: client, authToken: 'tok');
      expect(
        () => api.getEmail(999),
        throwsA(isA<ApiException>().having(
          (e) => e.statusCode,
          'statusCode',
          404,
        )),
      );
    });

    test('getEmails throws ApiException on SocketException', () async {
      final client = MockClient((request) async {
        throw const SocketException('Connection reset by peer');
      });

      final api = ApiService(client: client, authToken: 'tok');
      expect(
        () => api.getEmails(folder: 'inbox'),
        throwsA(isA<ApiException>()
            .having((e) => e.statusCode, 'statusCode', 0)
            .having((e) => e.message, 'message',
                contains('Keine Verbindung zum Dopis-Server möglich'))),
      );
    });

    test('sanitizes baseUrl by stripping trailing slash', () {
      final api = ApiService(baseUrl: 'http://192.168.178.20:4321/');
      expect(api.baseUrl, 'http://192.168.178.20:4321');

      api.setBaseUrl('http://localhost:4321///');
      // Strips trailing slash
      expect(api.baseUrl.endsWith('/'), isFalse);
    });
  });
}
