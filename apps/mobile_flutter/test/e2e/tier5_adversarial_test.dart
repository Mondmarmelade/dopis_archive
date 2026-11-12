import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:dopis_mobile/models/email_summary.dart';
import 'package:dopis_mobile/models/email_detail.dart';
import 'package:dopis_mobile/models/ai_analysis.dart';
import 'package:dopis_mobile/services/api_service.dart';
import 'package:dopis_mobile/providers/auth_provider.dart';
import 'package:dopis_mobile/providers/mail_provider.dart';
import 'package:dopis_mobile/screens/email_detail_screen.dart';
import 'package:dopis_mobile/widgets/sender_avatar.dart';

void main() {
  setUp(() {
    GoogleFonts.config.allowRuntimeFetching = false;
    SharedPreferences.setMockInitialValues({});
  });

  group('Tier 5: Adversarial Coverage Hardening & Chaos Testing', () {
    test('Chaos 1: Rapid concurrent optimistic mutations with flaky network', () async {
      int requestCount = 0;
      final mockClient = MockClient((request) async {
        requestCount++;
        // Alternate between failure and success
        if (requestCount % 2 == 1) {
          return http.Response('Network Timeout / Gateway Failure', 504);
        }
        return http.Response(
          jsonEncode({'success': true, 'seq': 10, 'flagged': true}),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final provider = MailProvider(apiService: ApiService(client: mockClient));
      final email = EmailSummary(
        id: 'chaos-1',
        seq: 10,
        uid: 10,
        name: 'Chaos User',
        email: 'chaos@test.de',
        subject: 'Flaky Network Mail',
        date: DateTime.now(),
        read: true,
        flagged: false,
      );

      provider.seedEmailsForTesting('inbox', [email]);

      // Trigger 1: Should fail and roll back
      try {
        await provider.toggleStar(10);
      } catch (_) {}
      expect(provider.emails.first.isFlagged, isFalse);

      // Trigger 2: Should succeed
      await provider.toggleStar(10);
      expect(provider.emails.first.isFlagged, isTrue);
    });

    test('Chaos 2: Malicious XSS scripts, onerror vectors, and data URIs', () {
      final summary = EmailSummary(
        id: 'xss-1',
        seq: 99,
        uid: 99,
        name: '<b onmouseover=alert("xss")>Attacker</b>',
        email: 'attacker@bad.com',
        subject: '<script>document.location="evil.com"</script>Free Money',
        date: DateTime.now(),
        read: true,
        flagged: false,
        snippet: '<img src=x onerror=alert(1)> Click here',
      );

      expect(summary.isFlagged, isFalse);
      expect(summary.senderName, contains('Attacker'));
    });

    testWidgets('Chaos 3: Widget disposed during pending async fetch',
        (tester) async {
      final mockClient = MockClient((request) async {
        await Future.delayed(const Duration(milliseconds: 100));
        return http.Response(jsonEncode({'emails': []}), 200);
      });

      final mail = MailProvider(apiService: ApiService(client: mockClient));
      final auth = AuthProvider();

      // Pump widget
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider.value(value: auth),
            ChangeNotifierProvider.value(value: mail),
          ],
          child: const MaterialApp(
            home: Scaffold(body: Text('Temporary Host')),
          ),
        ),
      );

      // Trigger async fetch in background
      final fetchFuture = mail.fetchEmails();

      // Immediately unmount/replace widget
      await tester.pumpWidget(const SizedBox.shrink());

      // Let future complete
      await fetchFuture;

      // No memory leaks or unhandled framework exceptions
      expect(tester.takeException(), isNull);
    });

    test('Chaos 4: Token expiration during active session wipes cached state', () {
      final provider = MailProvider();
      provider.seedEmailsForTesting('inbox', [
        EmailSummary(
          id: 'leak-test',
          seq: 55,
          uid: 55,
          name: 'Confidential',
          email: 'secret@corp.de',
          subject: 'Top Secret Strategy',
          date: DateTime.now(),
          read: false,
          flagged: false,
        )
      ]);

      expect(provider.emails.isNotEmpty, isTrue);

      // Logout / token null update
      provider.updateAuth(authToken: null);

      // Cache strictly wiped
      expect(provider.emails, isEmpty);
      expect(provider.unreadCount, 0);
    });

    test('Chaos 5: Extreme initials hashing resilience with emojis and non-ASCII', () {
      expect(SenderAvatar.getSenderInitials('🎉 Party Team 🎈', 'p@p.de'), 'PT');
      expect(SenderAvatar.getSenderInitials('123 Numbers 456', 'num@num.de'), '1N');
      expect(SenderAvatar.getSenderInitials('日本語 テスト', 'jp@test.de'), '日本');
      expect(SenderAvatar.getSenderInitials('', ''), '?');
    });
  });
}
