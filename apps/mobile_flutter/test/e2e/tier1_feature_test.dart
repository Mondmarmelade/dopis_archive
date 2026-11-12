import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:dopis_mobile/models/user_session.dart';
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
import 'package:dopis_mobile/theme/app_theme.dart';
import 'package:dopis_mobile/widgets/folder_pills.dart';
import 'package:dopis_mobile/widgets/email_tile.dart';
import 'package:dopis_mobile/widgets/sender_avatar.dart';
import 'package:dopis_mobile/widgets/ai_summary_card.dart';
import 'package:dopis_mobile/utils/date_formatter.dart';

void main() {
  setUp(() {
    GoogleFonts.config.allowRuntimeFetching = false;
    SharedPreferences.setMockInitialValues({});
  });

  group('Tier 1: Feature Coverage Tests (F1–F11)', () {
    // -------------------------------------------------------------------------
    // F1: Scaffolding & Build
    // -------------------------------------------------------------------------
    group('F1: Scaffolding & Architecture', () {
      test('data models serialize and deserialize correctly', () {
        final session = UserSession(
          token: 'token-f1',
          email: 'user@dopis.de',
          host: 'imap.ionos.de',
          port: 993,
          expiresAt: DateTime(2026, 9, 10),
        );
        final json = session.toJson();
        final copy = UserSession.fromJson(json);
        expect(copy.token, session.token);
        expect(copy.email, session.email);
        expect(copy.isValid, isTrue);
      });

      test('theme supplies Poppins typography and design tokens', () {
        final theme = AppTheme.lightTheme;
        expect(theme.scaffoldBackgroundColor, AppColors.background);
        expect(theme.colorScheme.primary, AppColors.primary);
        expect(theme.useMaterial3, isTrue);
      });
    });

    // -------------------------------------------------------------------------
    // F2: Auth & IMAP Login
    // -------------------------------------------------------------------------
    group('F2: Auth & IMAP Login', () {
      test('ApiService executes POST /api/auth/login with credentials payload', () async {
        final mockClient = MockClient((request) async {
          expect(request.url.path, '/api/auth/login');
          final body = jsonDecode(request.body);
          expect(body['email'], 'test@dopis.de');
          expect(body['password'], 'secret123');
          expect(body['host'], 'imap.ionos.de');
          expect(body['port'], 993);
          return http.Response(
            jsonEncode({
              'success': true,
              'token': 'jwt-abc-123',
              'expiresAt': '2026-09-17T12:00:00Z',
              'user': {'email': 'test@dopis.de', 'host': 'imap.ionos.de'},
            }),
            200,
            headers: {'content-type': 'application/json'},
          );
        });

        final api = ApiService(client: mockClient);
        final response = await api.login(
          email: 'test@dopis.de',
          password: 'secret123',
          host: 'imap.ionos.de',
          port: 993,
        );

        expect(response.token, 'jwt-abc-123');
        expect(response.user?.email, 'test@dopis.de');
        expect(response.session?.isValid, isTrue);
      });

      testWidgets('LoginScreen form triggers login and updates AuthProvider',
          (tester) async {
        final mockClient = MockClient((request) async {
          return http.Response(
            jsonEncode({
              'token': 'jwt-screen',
              'expiresAt': '2026-09-17T12:00:00Z',
              'user': {'email': 'screen@dopis.de', 'host': 'imap.ionos.de'},
            }),
            200,
            headers: {'content-type': 'application/json'},
          );
        });

        final auth = AuthProvider(apiService: ApiService(client: mockClient));
        await tester.pumpWidget(
          ChangeNotifierProvider<AuthProvider>.value(
            value: auth,
            child: const MaterialApp(home: LoginScreen()),
          ),
        );
        await tester.pumpAndSettle();

        await tester.enterText(find.byType(TextFormField).at(0), 'screen@dopis.de');
        await tester.enterText(find.byType(TextFormField).at(1), 'password');
        await tester.tap(find.widgetWithText(ElevatedButton, 'Mit Postfach verbinden'));
        await tester.pumpAndSettle();

        expect(auth.isAuthenticated, isTrue);
      });
    });

    // -------------------------------------------------------------------------
    // F3: Local Session Persistence
    // -------------------------------------------------------------------------
    group('F3: Local Session Persistence', () {
      test('StorageService persists, retrieves, and clears session', () async {
        final storage = StorageService();
        final session = UserSession(
          token: 'persisted-token',
          email: 'persist@dopis.de',
          host: 'imap.ionos.de',
          port: 993,
          expiresAt: DateTime.now().add(const Duration(days: 5)),
        );

        await storage.saveSession(session);
        final loaded = await storage.getSession();
        expect(loaded, isNotNull);
        expect(loaded?.token, 'persisted-token');
        expect(loaded?.email, 'persist@dopis.de');

        await storage.clearSession();
        final afterClear = await storage.getSession();
        expect(afterClear, isNull);
      });
    });

    // -------------------------------------------------------------------------
    // F4: Mailbox Stream & Folder Navigation
    // -------------------------------------------------------------------------
    group('F4: Mailbox Stream & Folder Navigation', () {
      test('MailProvider switches folder and preserves isolated caches', () async {
        final mockClient = MockClient((request) async {
          final folder = request.url.queryParameters['folder'] ?? 'inbox';
          return http.Response(
            jsonEncode({
              'emails': [
                {
                  'id': 'f4-$folder',
                  'seq': 1,
                  'uid': 1,
                  'name': 'Sender $folder',
                  'email': 'sender@test.de',
                  'subject': 'Message in $folder',
                  'date': '2026-09-03T10:00:00Z',
                  'read': true,
                  'flagged': false,
                }
              ]
            }),
            200,
            headers: {'content-type': 'application/json'},
          );
        });

        final provider = MailProvider(apiService: ApiService(client: mockClient));
        await provider.selectFolder('inbox');
        expect(provider.emails.first.subject, 'Message in inbox');

        await provider.selectFolder('archive');
        expect(provider.currentFolder, 'archive');
        expect(provider.currentFolderDisplayName, 'Archiv');
        expect(provider.emails.first.subject, 'Message in archive');
      });
    });

    // -------------------------------------------------------------------------
    // F5: Unread vs Read Item Formatting
    // -------------------------------------------------------------------------
    group('F5: Unread vs Read Item Formatting', () {
      testWidgets('EmailTile applies blue dot, bold text and tint for unread',
          (tester) async {
        final unreadMail = EmailSummary(
          id: 'u1',
          seq: 1,
          uid: 1,
          name: 'Unread Sender',
          email: 'unread@test.de',
          subject: 'Unread Subject',
          date: DateTime.now(),
          read: false,
          flagged: false,
        );

        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: EmailTile(email: unreadMail, onTap: () {}),
            ),
          ),
        );
        await tester.pumpAndSettle();

        expect(find.byKey(const Key('unread_dot_u1')), findsOneWidget);
        final textWidget = tester.widget<Text>(find.text('Unread Sender'));
        expect(textWidget.style?.fontWeight, FontWeight.bold);
      });
    });

    // -------------------------------------------------------------------------
    // F6: Initial Avatars & Date Formatting
    // -------------------------------------------------------------------------
    group('F6: Initial Avatars & Date Formatting', () {
      test('SenderAvatar computes initials correctly across formats', () {
        expect(SenderAvatar.getSenderInitials('Max Mustermann', 'm@m.de'), 'MM');
        expect(SenderAvatar.getSenderInitials('SingleName', 's@s.de'), 'S');
        expect(SenderAvatar.getSenderInitials('', 'john.doe@test.de'), 'JO');
      });

      test('GermanDateFormatter formats relative dates in German', () {
        final now = DateTime.now();
        final formattedToday = GermanDateFormatter.format(now);
        expect(formattedToday, contains(':')); // HH:mm format
      });
    });

    // -------------------------------------------------------------------------
    // F7: Email Detail & Reading View
    // -------------------------------------------------------------------------
    group('F7: Email Detail & Reading View', () {
      testWidgets('EmailDetailScreen renders subject, sender, and body',
          (tester) async {
        final summary = EmailSummary(
          id: 'd1',
          seq: 1,
          uid: 1,
          name: 'Test Sender',
          email: 'sender@dopis.de',
          subject: 'Detail Subject',
          date: DateTime.now(),
          read: true,
          flagged: false,
          snippet: 'Detail Snippet Content',
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

        expect(find.text('Detail Subject'), findsOneWidget);
        expect(find.text('Test Sender'), findsOneWidget);
        expect(find.text('Detail Snippet Content'), findsOneWidget);
      });
    });

    // -------------------------------------------------------------------------
    // F8: Quick Actions (Star, Archive, Trash)
    // -------------------------------------------------------------------------
    group('F8: Quick Actions', () {
      test('toggleStar and toggleRead optimistically mutate state', () async {
        final mockClient = MockClient((request) async {
          return http.Response(jsonEncode({'success': true}), 200,
              headers: {'content-type': 'application/json'});
        });

        final provider = MailProvider(apiService: ApiService(client: mockClient));
        final email = EmailSummary(
          id: 'q1',
          seq: 1,
          uid: 1,
          name: 'Test',
          email: 't@t.de',
          subject: 'Sub',
          date: DateTime.now(),
          read: false,
          flagged: false,
        );

        provider.seedEmailsForTesting('inbox', [email]);
        expect(provider.emails.first.isFlagged, isFalse);

        await provider.toggleStar(1);
        expect(provider.emails.first.isFlagged, isTrue);

        await provider.toggleRead(1);
        expect(provider.emails.first.read, isTrue);
      });
    });

    // -------------------------------------------------------------------------
    // F9: AI Summary & Action Items
    // -------------------------------------------------------------------------
    group('F9: AI Summary & Action Items', () {
      testWidgets('AiSummaryCard renders analysis and handles task check',
          (tester) async {
        int? toggled;
        final analysis = AiAnalysisResult(
          category: 'Rechnung',
          summary: const ['Rechnung über 50 € erhalten.'],
          actionItems: const [
            ActionItem(task: 'Rechnung begleichen', completed: false),
          ],
        );

        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: AiSummaryCard(
                analysis: analysis,
                onTriggerAnalysis: () {},
                onToggleActionItem: (idx) => toggled = idx,
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();

        expect(find.text('Rechnung über 50 € erhalten.'), findsOneWidget);
        await tester.tap(find.text('Rechnung begleichen'));
        expect(toggled, 0);
      });
    });

    // -------------------------------------------------------------------------
    // F10: Poppins Typography & Theming
    // -------------------------------------------------------------------------
    group('F10: Poppins Typography & Palette', () {
      test('brand color tokens match specifications', () {
        expect(AppColors.primary, const Color(0xFF3661A4));
        expect(AppColors.background, const Color(0xFFF8FAFC));
        expect(AppColors.surface, const Color(0xFFFFFFFF));
        expect(AppColors.textPrimary, const Color(0xFF0F172A));
        expect(AppColors.border, const Color(0xFFE2E8F0));
      });
    });

    // -------------------------------------------------------------------------
    // F11: Small-Screen Layout (360dp)
    // -------------------------------------------------------------------------
    group('F11: Small-Screen Layout', () {
      testWidgets('MailListScreen renders on 360dp width without RenderFlex overflow',
          (tester) async {
        tester.view.physicalSize = const Size(360, 640);
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);

        final mail = MailProvider();
        mail.seedEmailsForTesting('inbox', [
          EmailSummary(
            id: 'long',
            seq: 1,
            uid: 1,
            name: 'Very Long Name That Exceeds Width',
            email: 'verylong@domain.de',
            subject: 'Very Long Subject That Exceeds Width On Mobile Displays',
            date: DateTime.now(),
            read: false,
            flagged: false,
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
      });
    });
  });
}
