import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:dopis_mobile/models/email_summary.dart';
import 'package:dopis_mobile/models/user_session.dart';
import 'package:dopis_mobile/providers/auth_provider.dart';
import 'package:dopis_mobile/providers/mail_provider.dart';
import 'package:dopis_mobile/screens/mail_list_screen.dart';
import 'package:dopis_mobile/widgets/folder_pills.dart';
import 'package:dopis_mobile/widgets/email_tile.dart';

Widget _createTestScreen({
  required AuthProvider auth,
  required MailProvider mail,
}) {
  return MultiProvider(
    providers: [
      ChangeNotifierProvider<AuthProvider>.value(value: auth),
      ChangeNotifierProvider<MailProvider>.value(value: mail),
    ],
    child: MaterialApp(
      home: const MailListScreen(),
      routes: {
        '/email-detail': (ctx) =>
            const Scaffold(body: Text('Email Detail View')),
      },
    ),
  );
}

void main() {
  setUp(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  group('MailListScreen Layout & Interaction Tests', () {
    testWidgets(
        'renders top bar matching AccountSwitcher: D badge, title, subtitle',
        (tester) async {
      final auth = AuthProvider();
      auth.setSessionForTesting(UserSession(
        token: 'test-token',
        email: 'nico@dopis.de',
        host: 'imap.ionos.de',
        port: 993,
        expiresAt: DateTime.now().add(const Duration(days: 7)),
      ));

      final mail = MailProvider();
      await tester.pumpWidget(_createTestScreen(auth: auth, mail: mail));
      await tester.pumpAndSettle();

      // "D" badge avatar
      expect(find.text('D'), findsOneWidget);

      // Title & Subtitle
      expect(find.text('Dopis'), findsOneWidget);
      expect(find.text('nico@dopis.de'), findsOneWidget);

      // Refresh & Logout action buttons
      expect(find.byIcon(Icons.refresh), findsOneWidget);
      expect(find.byIcon(Icons.logout_rounded), findsOneWidget);
    });

    testWidgets(
        'logout action shows confirmation dialog and cancels or logs out',
        (tester) async {
      final auth = AuthProvider();
      auth.setSessionForTesting(UserSession(
        token: 'test-token',
        email: 'user@test.de',
        host: 'imap.ionos.de',
        port: 993,
        expiresAt: DateTime.now().add(const Duration(days: 7)),
      ));

      final mail = MailProvider();
      await tester.pumpWidget(_createTestScreen(auth: auth, mail: mail));
      await tester.pumpAndSettle();

      // Tap logout icon
      await tester.tap(find.byIcon(Icons.logout_rounded));
      await tester.pumpAndSettle();

      // Confirmation dialog displayed
      expect(find.text('Abmelden'), findsWidgets);
      expect(
          find.text('Möchtest du dich wirklich von deinem Postfach abmelden?'),
          findsOneWidget);
      expect(find.text('Abbrechen'), findsOneWidget);

      // Tap "Abbrechen" -> dialog dismissed, session intact
      await tester.tap(find.text('Abbrechen'));
      await tester.pumpAndSettle();
      expect(auth.isAuthenticated, isTrue);

      // Tap logout icon again -> confirm "Abmelden"
      await tester.tap(find.byIcon(Icons.logout_rounded));
      await tester.pumpAndSettle();

      await tester.tap(find.widgetWithText(ElevatedButton, 'Abmelden'));
      await tester.pumpAndSettle();

      // Session cleared
      expect(auth.isAuthenticated, isFalse);
    });

    testWidgets('renders sticky folder pills row', (tester) async {
      final auth = AuthProvider();
      final mail = MailProvider();

      await tester.pumpWidget(_createTestScreen(auth: auth, mail: mail));
      await tester.pumpAndSettle();

      expect(find.byType(FolderPills), findsOneWidget);
      expect(find.text('Posteingang'), findsOneWidget);
      expect(find.text('Gesendet'), findsOneWidget);
    });

    testWidgets(
        'displays empty state with German copy when no emails exist',
        (tester) async {
      final auth = AuthProvider();
      final mail = MailProvider();
      mail.clearEmailsForTesting();

      await tester.pumpWidget(_createTestScreen(auth: auth, mail: mail));
      await tester.pumpAndSettle();

      expect(find.text('Keine E-Mails gefunden'), findsOneWidget);
      expect(
          find.text(
              'Dein Postfach oder Suchfilter enthält derzeit keine Ergebnisse.'),
          findsOneWidget);
      expect(find.byIcon(Icons.inbox_outlined), findsOneWidget);
    });

    testWidgets(
        'displays error state with German copy and retry button on failure',
        (tester) async {
      final auth = AuthProvider();
      final mail = MailProvider();
      mail.setErrorForTesting('Verbindung zum Server fehlgeschlagen.');

      await tester.pumpWidget(_createTestScreen(auth: auth, mail: mail));
      await tester.pumpAndSettle();

      expect(find.text('E-Mails konnten nicht geladen werden'), findsOneWidget);
      expect(
          find.text('Verbindung zum Server fehlgeschlagen.'), findsOneWidget);
      expect(find.text('Erneut versuchen'), findsOneWidget);

      // Tap retry button
      await tester.tap(find.text('Erneut versuchen'));
      await tester.pump();
    });

    testWidgets('renders email list items and navigates on tap',
        (tester) async {
      final auth = AuthProvider();
      final mail = MailProvider();
      mail.seedEmailsForTesting('inbox', [
        EmailSummary(
          id: '1',
          seq: 1,
          uid: 1,
          name: 'Chef',
          email: 'chef@firma.de',
          subject: 'Dringendes Meeting',
          date: DateTime.now(),
          read: false,
          flagged: false,
          snippet: 'Bitte heute um 16 Uhr...',
        ),
      ]);

      await tester.pumpWidget(_createTestScreen(auth: auth, mail: mail));
      await tester.pumpAndSettle();

      expect(find.byType(EmailTile), findsOneWidget);
      expect(find.text('Chef'), findsOneWidget);
      expect(find.text('Dringendes Meeting'), findsOneWidget);

      await tester.tap(find.byType(EmailTile));
      await tester.pumpAndSettle();

      expect(find.text('Email Detail View'), findsOneWidget);
    });

    testWidgets(
        'renders cleanly on 360 x 640 dp compact viewport without overflow',
        (tester) async {
      tester.view.physicalSize = const Size(360, 640);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final auth = AuthProvider();
      auth.setSessionForTesting(UserSession(
        token: 'test-token',
        email: 'superlongemailaddress.department@verylongdomainname.de',
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
          name: 'Very Long Sender Name From Large Corporation',
          email: 'sender@longdomain.de',
          subject:
              'Very Long Subject Line That Could Cause Flex Overflow If Not Handled With Ellipsis',
          date: DateTime.now(),
          read: false,
          flagged: true,
          snippet:
              'Long snippet text explaining the details of the communication...',
        ),
      ]);

      await tester.pumpWidget(_createTestScreen(auth: auth, mail: mail));
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.text('Dopis'), findsOneWidget);
      expect(find.byType(EmailTile), findsOneWidget);
    });
  });
}
