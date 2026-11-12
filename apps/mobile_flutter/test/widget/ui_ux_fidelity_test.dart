import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:dopis_mobile/models/email_summary.dart';
import 'package:dopis_mobile/models/user_session.dart';
import 'package:dopis_mobile/providers/auth_provider.dart';
import 'package:dopis_mobile/providers/mail_provider.dart';
import 'package:dopis_mobile/screens/login_screen.dart';
import 'package:dopis_mobile/screens/mail_list_screen.dart';
import 'package:dopis_mobile/screens/email_detail_screen.dart';
import 'package:dopis_mobile/theme/app_theme.dart';
import 'package:dopis_mobile/widgets/folder_pills.dart';
import 'package:dopis_mobile/widgets/email_tile.dart';
import 'package:dopis_mobile/widgets/sender_avatar.dart';

Widget _buildThemedApp({
  required Widget child,
  AuthProvider? auth,
  MailProvider? mail,
}) {
  return MultiProvider(
    providers: [
      ChangeNotifierProvider<AuthProvider>.value(
        value: auth ?? AuthProvider(),
      ),
      ChangeNotifierProvider<MailProvider>.value(
        value: mail ?? MailProvider(),
      ),
    ],
    child: MaterialApp(
      theme: AppTheme.lightTheme,
      home: child,
    ),
  );
}

void main() {
  setUp(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  group('Milestone 4: UI/UX Fidelity, Poppins & 360dp Ergonomics (Requirement R4)', () {
    test('AppTheme defines exact brand color tokens', () {
      expect(AppColors.primary, const Color(0xFF3661A4));
      expect(AppColors.background, const Color(0xFFF8FAFC));
      expect(AppColors.surface, const Color(0xFFFFFFFF));
      expect(AppColors.textPrimary, const Color(0xFF0F172A));
      expect(AppColors.border, const Color(0xFFE2E8F0));
      expect(AppColors.starred, const Color(0xFFFBBF24));
    });

    testWidgets('LoginScreen renders cleanly on 360 x 640 dp with minimum 46-48dp targets',
        (tester) async {
      tester.view.physicalSize = const Size(360, 640);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(_buildThemedApp(child: const LoginScreen()));
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);

      // Verify submit button touch target height >= 46dp
      final submitButtonFinder = find.widgetWithText(ElevatedButton, 'Mit Postfach verbinden');
      expect(submitButtonFinder, findsOneWidget);
      final buttonSize = tester.getSize(submitButtonFinder);
      expect(buttonSize.height, greaterThanOrEqualTo(46.0));

      // Verify form fields
      expect(find.byType(TextFormField), findsNWidgets(4));
    });

    testWidgets('MailListScreen renders cleanly on 360 x 640 dp with responsive email stream',
        (tester) async {
      tester.view.physicalSize = const Size(360, 640);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final auth = AuthProvider();
      auth.setSessionForTesting(UserSession(
        token: 'token-4',
        email: 'user.name@unternehmensgruppe-deutschland.de',
        host: 'imap.ionos.de',
        port: 993,
        expiresAt: DateTime.now().add(const Duration(days: 7)),
      ));

      final mail = MailProvider();
      mail.seedEmailsForTesting('inbox', [
        EmailSummary(
          id: '1',
          seq: 1,
          uid: 1,
          name: 'Maximilian Graf von und zu Musterhausen',
          email: 'maximilian.graf@musterhausen-ag.com',
          subject: 'Wichtige Quartalsabstimmung und Terminplanung für Q4 2026',
          date: DateTime.now(),
          read: false,
          flagged: true,
          snippet: 'Sehr geehrte Damen und Herren, anbei erhalten Sie den Entwurf...',
        ),
      ]);

      await tester.pumpWidget(_buildThemedApp(
        child: const MailListScreen(),
        auth: auth,
        mail: mail,
      ));
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.byType(FolderPills), findsOneWidget);
      expect(find.byType(EmailTile), findsOneWidget);

      // Verify email tile touch height >= 48dp
      final tileFinder = find.byType(EmailTile);
      final tileSize = tester.getSize(tileFinder);
      expect(tileSize.height, greaterThanOrEqualTo(48.0));
    });

    testWidgets('EmailDetailScreen renders cleanly on 360 x 640 dp with 48dp touch targets',
        (tester) async {
      tester.view.physicalSize = const Size(360, 640);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final summary = EmailSummary(
        id: '10',
        seq: 10,
        uid: 10,
        name: 'Vorstandsbüro Deutsche Industrieholding GmbH',
        email: 'vorstand@industrieholding.de',
        subject: 'Einladung zur ordentlichen Gesellschafterversammlung 2026',
        date: DateTime.now(),
        read: true,
        flagged: true,
        snippet: 'Die Versammlung findet am 15. Oktober statt...',
      );

      await tester.pumpWidget(_buildThemedApp(
        child: EmailDetailScreen(emailSummary: summary),
      ));
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);

      // Verify back button target >= 48dp
      final backButton = find.widgetWithText(TextButton, 'Zurück');
      expect(backButton, findsOneWidget);
      final backSize = tester.getSize(backButton);
      expect(backSize.height, greaterThanOrEqualTo(48.0));
      expect(backSize.width, greaterThanOrEqualTo(48.0));

      // Verify avatar size
      final avatarFinder = find.byType(SenderAvatar);
      expect(avatarFinder, findsOneWidget);
      final avatarSize = tester.getSize(avatarFinder);
      expect(avatarSize.width, equals(40.0));
      expect(avatarSize.height, equals(40.0));
    });
  });
}
