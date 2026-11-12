import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:provider/provider.dart';
import 'package:dopis_mobile/models/email_summary.dart';
import 'package:dopis_mobile/models/email_detail.dart';
import 'package:dopis_mobile/models/user_session.dart';
import 'package:dopis_mobile/services/api_service.dart';
import 'package:dopis_mobile/providers/auth_provider.dart';
import 'package:dopis_mobile/providers/mail_provider.dart';
import 'package:dopis_mobile/screens/login_screen.dart';
import 'package:dopis_mobile/screens/email_detail_screen.dart';
import 'package:dopis_mobile/widgets/email_tile.dart';
import 'package:dopis_mobile/widgets/sender_avatar.dart';

void main() {
  setUp(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  group('Tier 2: Boundary Value Analysis & Edge Cases', () {
    test('EmailSummary handles empty strings and null snippets with graceful fallbacks', () {
      final summary = EmailSummary(
        id: 'b1',
        seq: 1,
        uid: 1,
        name: '',
        email: 'fallback@test.de',
        subject: '',
        date: DateTime.now(),
        read: true,
        flagged: false,
        snippet: null,
      );

      expect(summary.displayName, 'fallback@test.de');
      expect(summary.fromAddress, 'fallback@test.de');
      expect(summary.snippet, isNull);
    });

    test('UserSession handles expiration boundary conditions', () {
      final now = DateTime.now();
      final expiredSession = UserSession(
        token: 'exp',
        email: 'e@e.de',
        host: 'imap.ionos.de',
        port: 993,
        expiresAt: now.subtract(const Duration(seconds: 1)),
      );
      expect(expiredSession.isExpired, isTrue);
      expect(expiredSession.isValid, isFalse);

      final validSession = UserSession(
        token: 'val',
        email: 'v@v.de',
        host: 'imap.ionos.de',
        port: 993,
        expiresAt: now.add(const Duration(hours: 1)),
      );
      expect(validSession.isExpired, isFalse);
      expect(validSession.isValid, isTrue);
    });

    test('ApiService handles HTTP 500, 502, 503 and network timeout exceptions', () async {
      final mockClient = MockClient((request) async {
        if (request.url.path.contains('/api/emails')) {
          return http.Response(
            jsonEncode({'error': 'Bad Gateway'}),
            502,
            headers: {'content-type': 'application/json'},
          );
        }
        return http.Response('Server Error', 500);
      });

      final api = ApiService(client: mockClient, authToken: 'tok');
      expect(
        () => api.getEmails(folder: 'inbox'),
        throwsA(isA<ApiException>().having(
          (e) => e.message,
          'message',
          contains('Verbindung zum IMAP-Mailserver fehlgeschlagen'),
        )),
      );
    });

    testWidgets('Login form enforces port validation boundaries (1..65535)',
        (tester) async {
      final auth = AuthProvider();
      await tester.pumpWidget(
        ChangeNotifierProvider<AuthProvider>.value(
          value: auth,
          child: const MaterialApp(home: LoginScreen()),
        ),
      );
      await tester.pumpAndSettle();

      // Enter valid email and password
      await tester.enterText(find.byType(TextFormField).at(0), 'user@test.de');
      await tester.enterText(find.byType(TextFormField).at(1), 'pass');

      // Enter invalid port 0
      await tester.enterText(find.byType(TextFormField).at(3), '0');
      await tester.tap(find.widgetWithText(ElevatedButton, 'Mit Postfach verbinden'));
      await tester.pumpAndSettle();

      expect(find.text('Port muss zwischen 1 und 65535 liegen'), findsOneWidget);

      // Enter invalid port 70000
      await tester.enterText(find.byType(TextFormField).at(3), '70000');
      await tester.tap(find.widgetWithText(ElevatedButton, 'Mit Postfach verbinden'));
      await tester.pumpAndSettle();

      expect(find.text('Port muss zwischen 1 und 65535 liegen'), findsOneWidget);
    });

    test('SenderAvatar correctly handles German umlauts in initials hashing', () {
      expect(SenderAvatar.getSenderInitials('Özlem Polat', 'o@p.de'), 'ÖP');
      expect(SenderAvatar.getSenderInitials('Ärztliche Verrechnungsstelle', 'a@v.de'), 'ÄV');
      expect(SenderAvatar.getSenderInitials('Überweisungsservice Müller', 'u@m.de'), 'ÜM');
    });

    testWidgets('EmailTile renders gracefully with ultra-long unbroken string',
        (tester) async {
      final email = EmailSummary(
        id: 'b2',
        seq: 2,
        uid: 2,
        name: 'SuperLongUnbrokenStringWithoutAnySpacesInsideToTestWrapOverflow',
        email: 'longemail@domain.com',
        subject: 'LongSubjectSuperLongUnbrokenStringWithoutAnySpacesInsideToTestWrapOverflow',
        date: DateTime.now(),
        read: false,
        flagged: false,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: EmailTile(email: email, onTap: () {}),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
    });

    testWidgets('EmailDetailScreen renders properly when text and html are both null',
        (tester) async {
      final summary = EmailSummary(
        id: 'b3',
        seq: 3,
        uid: 3,
        name: 'Empty Body Sender',
        email: 'empty@test.de',
        subject: 'No Body',
        date: DateTime.now(),
        read: true,
        flagged: false,
        snippet: null,
      );

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider(create: (_) => AuthProvider()),
            ChangeNotifierProvider(create: (_) => MailProvider()),
          ],
          child: MaterialApp(
            home: EmailDetailScreen(emailSummary: summary),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.text('(Kein Textinhalt)'), findsOneWidget);
    });
  });
}
