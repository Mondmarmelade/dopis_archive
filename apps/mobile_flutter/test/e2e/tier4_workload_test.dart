import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:dopis_mobile/main.dart';
import 'package:dopis_mobile/models/email_summary.dart';
import 'package:dopis_mobile/models/email_detail.dart';
import 'package:dopis_mobile/models/ai_analysis.dart';
import 'package:dopis_mobile/services/api_service.dart';
import 'package:dopis_mobile/services/storage_service.dart';
import 'package:dopis_mobile/providers/auth_provider.dart';
import 'package:dopis_mobile/providers/mail_provider.dart';
import 'package:dopis_mobile/screens/login_screen.dart';
import 'package:dopis_mobile/screens/mail_list_screen.dart';
import 'package:dopis_mobile/screens/email_detail_screen.dart';
import 'package:dopis_mobile/widgets/folder_pills.dart';
import 'package:dopis_mobile/widgets/email_tile.dart';
import 'package:dopis_mobile/widgets/ai_summary_card.dart';

void main() {
  setUp(() {
    GoogleFonts.config.allowRuntimeFetching = false;
    SharedPreferences.setMockInitialValues({});
  });

  group('Tier 4: Real-World Application Workload Scenarios', () {
    // -------------------------------------------------------------------------
    // Scenario 1: Cold Start -> Login -> Fetch Inbox -> Read Unread Mail
    // -------------------------------------------------------------------------
    testWidgets('Scenario 1: Cold Start -> Login -> Fetch Inbox -> Read Unread Mail',
        (tester) async {
      final mockClient = MockClient((request) async {
        if (request.url.path == '/api/auth/login') {
          return http.Response(
            jsonEncode({
              'success': true,
              'token': 'workflow-token-1',
              'expiresAt': '2026-09-17T12:00:00Z',
              'user': {'email': 'workflow@dopis.de', 'host': 'imap.ionos.de'},
            }),
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        if (request.url.path.contains('/api/emails')) {
          return http.Response(
            jsonEncode({
              'emails': [
                {
                  'id': 'sc1-mail',
                  'seq': 100,
                  'uid': 100,
                  'name': 'Wichtiger Kunde',
                  'email': 'kunde@partner.de',
                  'subject': 'Projektauftrag unterschrieben',
                  'date': '2026-09-03T11:00:00Z',
                  'read': false,
                  'flagged': false,
                  'snippet': 'Sehr geehrtes Team, der Vertrag ist unterschrieben.',
                },
              ],
            }),
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        if (request.url.path.contains('/api/email')) {
          return http.Response(
            jsonEncode({
              'id': 'sc1-mail',
              'seq': 100,
              'uid': 100,
              'subject': 'Projektauftrag unterschrieben',
              'from': {'name': 'Wichtiger Kunde', 'address': 'kunde@partner.de'},
              'to': [{'name': 'Team', 'address': 'workflow@dopis.de'}],
              'date': '2026-09-03T11:00:00Z',
              'text': 'Sehr geehrtes Team, der Vertrag ist hiermit unterschrieben.',
              'read': true,
              'flagged': false,
            }),
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        if (request.url.path == '/api/flags') {
          return http.Response(
            jsonEncode({'success': true, 'seq': 100, 'seen': true}),
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        return http.Response('Not Found', 404);
      });

      final api = ApiService(client: mockClient);
      final auth = AuthProvider(apiService: api);
      final mail = MailProvider(apiService: api);

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider.value(value: auth),
            ChangeNotifierProvider.value(value: mail),
          ],
          child: MaterialApp(
            home: const AuthGate(),
            routes: {
              '/login': (_) => const LoginScreen(),
              '/mail': (_) => const MailListScreen(),
              '/email-detail': (ctx) {
                final args = ModalRoute.of(ctx)?.settings.arguments as EmailSummary;
                return EmailDetailScreen(emailSummary: args);
              },
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Step 1: User fills credentials on LoginScreen
      expect(find.byType(LoginScreen), findsOneWidget);
      await tester.enterText(find.byType(TextFormField).at(0), 'workflow@dopis.de');
      await tester.enterText(find.byType(TextFormField).at(1), 'mypassword');
      await tester.tap(find.widgetWithText(ElevatedButton, 'Mit Postfach verbinden'));
      await tester.pumpAndSettle();

      // Step 2: Transitions to MailListScreen and displays inbox item
      expect(auth.isAuthenticated, isTrue);
      expect(find.byType(MailListScreen), findsOneWidget);
      expect(find.text('Wichtiger Kunde'), findsOneWidget);
      expect(find.text('Projektauftrag unterschrieben'), findsOneWidget);

      // Step 3: Tap email tile -> opens EmailDetailScreen
      await tester.tap(find.byType(EmailTile));
      await tester.pumpAndSettle();

      expect(find.byType(EmailDetailScreen), findsOneWidget);
      expect(find.text('Sehr geehrtes Team, der Vertrag ist unterschrieben.'), findsOneWidget);

      // Step 4: Tap back button -> returns to MailListScreen
      await tester.tap(find.widgetWithText(TextButton, 'Zurück'));
      await tester.pumpAndSettle();

      expect(find.byType(MailListScreen), findsOneWidget);
    });

    // -------------------------------------------------------------------------
    // Scenario 2: Star Mail -> Archive Mail -> Verify List Update
    // -------------------------------------------------------------------------
    testWidgets('Scenario 2: Star Mail -> Archive Mail -> Verify List Update',
        (tester) async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({'success': true}),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final api = ApiService(client: mockClient);
      final auth = AuthProvider();
      final mail = MailProvider(apiService: api);

      final mail1 = EmailSummary(
        id: 'sc2-1',
        seq: 201,
        uid: 201,
        name: 'Partner AG',
        email: 'partner@ag.de',
        subject: 'Wichtiges Angebot',
        date: DateTime.now(),
        read: true,
        flagged: false,
      );

      mail.seedEmailsForTesting('inbox', [mail1]);

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider.value(value: auth),
            ChangeNotifierProvider.value(value: mail),
          ],
          child: MaterialApp(
            home: const MailListScreen(),
            routes: {
              '/email-detail': (ctx) {
                final args = ModalRoute.of(ctx)?.settings.arguments as EmailSummary;
                return EmailDetailScreen(emailSummary: args);
              },
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Wichtiges Angebot'), findsOneWidget);

      // Step 1: Open detail view
      await tester.tap(find.byType(EmailTile));
      await tester.pumpAndSettle();

      // Step 2: Star the email
      await tester.tap(find.byTooltip('Markieren'));
      await tester.pumpAndSettle();
      expect(mail.emails.first.isFlagged, isTrue);

      // Step 3: Archive the email -> pops back to mail list
      await tester.tap(find.byTooltip('Archivieren'));
      await tester.pumpAndSettle();

      // Step 4: Verify email is removed from inbox stream
      expect(mail.emails, isEmpty);
      expect(find.text('Keine E-Mails gefunden'), findsOneWidget);
    });

    // -------------------------------------------------------------------------
    // Scenario 3: Open Newsletter -> Trigger AI Summary -> Toggle Action Checklist
    // -------------------------------------------------------------------------
    testWidgets('Scenario 3: Open Newsletter -> Trigger AI Summary -> Toggle Action Checklist',
        (tester) async {
      final mockClient = MockClient((request) async {
        if (request.url.path == '/api/ai/analyze') {
          return http.Response(
            jsonEncode({
              'category': 'Newsletter',
              'tags': ['Tech', 'AI'],
              'summary': [
                'Neues Release von Flutter veröffentlicht.',
                'Wichtige Sicherheitsupdates integriert.',
              ],
              'actionItems': [
                {'task': 'Auf Flutter 3.41 aktualisieren', 'due': 'Heute', 'completed': false},
              ],
            }),
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        return http.Response('{}', 200, headers: {'content-type': 'application/json'});
      });

      final api = ApiService(client: mockClient);
      final mail = MailProvider(apiService: api);
      final auth = AuthProvider();

      final newsletter = EmailSummary(
        id: 'sc3-news',
        seq: 301,
        uid: 301,
        name: 'Flutter Devs',
        email: 'news@flutter.dev',
        subject: 'Flutter Newsletter September 2026',
        date: DateTime.now(),
        read: true,
        flagged: false,
        snippet: 'Hier sind die neuesten Updates...',
      );

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider.value(value: auth),
            ChangeNotifierProvider.value(value: mail),
          ],
          child: MaterialApp(
            home: EmailDetailScreen(emailSummary: newsletter),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Step 1: Trigger AI Analysis
      expect(find.text('✦ KI-Zusammenfassung'), findsOneWidget);
      await tester.tap(find.text('Analysieren'));
      await tester.pumpAndSettle();

      // Step 2: Verify AI Summary rendered
      expect(find.text('Neues Release von Flutter veröffentlicht.'), findsOneWidget);
      expect(find.text('Auf Flutter 3.41 aktualisieren'), findsOneWidget);

      // Step 3: Toggle action item checkmark
      await tester.tap(find.text('Auf Flutter 3.41 aktualisieren'));
      await tester.pumpAndSettle();

      // Verified toggle executed
      final analysis = mail.aiCache[301];
      expect(analysis?.actionItems.first.completed, isTrue);
    });

    // -------------------------------------------------------------------------
    // Scenario 4: Switch between all 4 German folders -> Pull to refresh
    // -------------------------------------------------------------------------
    testWidgets('Scenario 4: Switch between all 4 German folders',
        (tester) async {
      final mockClient = MockClient((request) async {
        final folder = request.url.queryParameters['folder'] ?? 'inbox';
        return http.Response(
          jsonEncode({'emails': []}),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final mail = MailProvider(apiService: ApiService(client: mockClient));
      final auth = AuthProvider();

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider.value(value: auth),
            ChangeNotifierProvider.value(value: mail),
          ],
          child: const MaterialApp(home: MailListScreen()),
        ),
      );
      await tester.pumpAndSettle();

      // Verify all 4 folders accessible and switchable
      await tester.tap(find.text('Gesendet'));
      await tester.pumpAndSettle();
      expect(mail.currentFolder, 'sent');

      await tester.tap(find.text('Archiv'));
      await tester.pumpAndSettle();
      expect(mail.currentFolder, 'archive');

      await tester.tap(find.text('Papierkorb'));
      await tester.pumpAndSettle();
      expect(mail.currentFolder, 'trash');

      await tester.tap(find.text('Posteingang'));
      await tester.pumpAndSettle();
      expect(mail.currentFolder, 'inbox');
    });

    // -------------------------------------------------------------------------
    // Scenario 5: Viewport Stress (360x640dp compact display) with long subjects
    // -------------------------------------------------------------------------
    testWidgets('Scenario 5: 360 x 640 dp compact display ergonomics stress',
        (tester) async {
      tester.view.physicalSize = const Size(360, 640);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final mail = MailProvider();
      mail.seedEmailsForTesting('inbox', [
        EmailSummary(
          id: 'sc5',
          seq: 501,
          uid: 501,
          name: 'Sehr Lange Absenderbezeichnung Aus Einer Großen Organisation',
          email: 'absender.mit.vielen.punkten@unternehmensnetzwerk-deutschland.de',
          subject: 'Einladung zur außerordentlichen Sitzung des Arbeitskreises Informationssicherheit',
          date: DateTime.now(),
          read: false,
          flagged: true,
          snippet: 'Anbei übersenden wir Ihnen die Tagesordnung für die anstehende Sitzung...',
        )
      ]);

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider(create: (_) => AuthProvider()),
            ChangeNotifierProvider.value(value: mail),
          ],
          child: const MaterialApp(home: MailListScreen()),
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.byType(EmailTile), findsOneWidget);
      expect(find.text('Dopis'), findsOneWidget);
    });
  });
}
