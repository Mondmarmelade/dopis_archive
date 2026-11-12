import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:dopis_mobile/providers/auth_provider.dart';
import 'package:dopis_mobile/screens/login_screen.dart';

Widget _buildTestApp(AuthProvider authProvider) {
  return ChangeNotifierProvider<AuthProvider>.value(
    value: authProvider,
    child: const MaterialApp(
      home: LoginScreen(),
    ),
  );
}

void main() {
  setUp(() {
    GoogleFonts.config.allowRuntimeFetching = false;
    SharedPreferences.setMockInitialValues({});
  });

  group('LoginScreen Challenge 1: Empty and Whitespace Input Validation', () {
    testWidgets('submitting completely empty inputs triggers validation errors on all fields',
        (tester) async {
      final auth = AuthProvider();
      await tester.pumpWidget(_buildTestApp(auth));
      await tester.pumpAndSettle();

      // Clear default prefilled host and port
      await tester.enterText(find.widgetWithText(TextFormField, 'imap.ionos.de'), '');
      await tester.enterText(find.widgetWithText(TextFormField, '993'), '');
      await tester.pumpAndSettle();

      // Tap submit
      await tester.tap(find.text('Mit Postfach verbinden'));
      await tester.pumpAndSettle();

      expect(find.text('Bitte Benutzername / E-Mail eingeben'), findsOneWidget);
      expect(find.text('Bitte Passwort eingeben'), findsOneWidget);
      expect(find.text('Bitte IMAP-Server angeben'), findsOneWidget);
      expect(find.text('Bitte Port angeben'), findsOneWidget);
    });

    testWidgets('submitting whitespace-only inputs triggers validation errors',
        (tester) async {
      final auth = AuthProvider();
      await tester.pumpWidget(_buildTestApp(auth));
      await tester.pumpAndSettle();

      // Enter spaces in email, host, port
      final emailFinder = find.widgetWithText(TextFormField, 'name@domain.de');
      final hostFinder = find.widgetWithText(TextFormField, 'imap.ionos.de');
      final portFinder = find.widgetWithText(TextFormField, '993');

      await tester.enterText(emailFinder, '   \t  ');
      await tester.enterText(hostFinder, '   ');
      await tester.enterText(portFinder, '   ');
      await tester.pumpAndSettle();

      // Tap submit
      await tester.tap(find.text('Mit Postfach verbinden'));
      await tester.pumpAndSettle();

      // Email and host should reject whitespace-only inputs
      expect(find.text('Bitte Benutzername / E-Mail eingeben'), findsOneWidget);
      expect(find.text('Bitte IMAP-Server angeben'), findsOneWidget);
      expect(find.text('Bitte Port angeben'), findsOneWidget);
    });

    testWidgets('email without @ symbol triggers invalid format error',
        (tester) async {
      final auth = AuthProvider();
      await tester.pumpWidget(_buildTestApp(auth));
      await tester.pumpAndSettle();

      await tester.enterText(
          find.widgetWithText(TextFormField, 'name@domain.de'), 'invaliduser');
      await tester.enterText(
          find.widgetWithText(TextFormField, '••••••••'), 'secret123');
      await tester.pumpAndSettle();

      await tester.tap(find.text('Mit Postfach verbinden'));
      await tester.pumpAndSettle();

      expect(find.text('Bitte eine gültige E-Mail-Adresse eingeben'), findsOneWidget);
    });
  });

  group('LoginScreen Challenge 2: Invalid Port Validation (0, -1, 70000, abc, 65536)', () {
    final invalidPorts = [
      '0',
      '-1',
      '70000',
      '65536',
      'abc',
      '993.5',
      '-993',
    ];

    for (final port in invalidPorts) {
      testWidgets('port "$port" triggers range validation error', (tester) async {
        final auth = AuthProvider();
        await tester.pumpWidget(_buildTestApp(auth));
        await tester.pumpAndSettle();

        // Valid email and password to isolate port validation
        await tester.enterText(
            find.widgetWithText(TextFormField, 'name@domain.de'), 'user@dopis.de');
        await tester.enterText(
            find.widgetWithText(TextFormField, '••••••••'), 'validpass');
        await tester.enterText(
            find.widgetWithText(TextFormField, '993'), port);
        await tester.pumpAndSettle();

        await tester.tap(find.text('Mit Postfach verbinden'));
        await tester.pumpAndSettle();

        expect(find.text('Port muss zwischen 1 und 65535 liegen'), findsOneWidget);
      });
    }

    testWidgets('valid port boundaries 1 and 65535 pass validation', (tester) async {
      final auth = AuthProvider();
      await tester.pumpWidget(_buildTestApp(auth));
      await tester.pumpAndSettle();

      await tester.enterText(
          find.widgetWithText(TextFormField, 'name@domain.de'), 'user@dopis.de');
      await tester.enterText(
          find.widgetWithText(TextFormField, '••••••••'), 'validpass');

      // Port 1 (minimum)
      await tester.enterText(find.widgetWithText(TextFormField, '993'), '1');
      await tester.pumpAndSettle();
      await tester.tap(find.text('Mit Postfach verbinden'));
      await tester.pumpAndSettle();
      expect(find.text('Port muss zwischen 1 und 65535 liegen'), findsNothing);

      // Port 65535 (maximum)
      await tester.enterText(find.widgetWithText(TextFormField, '1'), '65535');
      await tester.pumpAndSettle();
      await tester.tap(find.text('Mit Postfach verbinden'));
      await tester.pumpAndSettle();
      expect(find.text('Port muss zwischen 1 und 65535 liegen'), findsNothing);
    });
  });

  group('LoginScreen Challenge 3: Error Banner Display and Dismissal Behavior', () {
    testWidgets('error banner renders with exact design tokens (#FEE2E2, #F87171, #991B1B)',
        (tester) async {
      final auth = AuthProvider();
      await tester.pumpWidget(_buildTestApp(auth));
      await tester.pumpAndSettle();

      // Trigger error
      auth.login(email: '', password: '', host: '', port: 993);
      await tester.pump();

      // Find error banner container
      final bannerFinder = find.byWidgetPredicate((widget) {
        if (widget is Container && widget.decoration is BoxDecoration) {
          final deco = widget.decoration as BoxDecoration;
          return deco.color == const Color(0xFFFEE2E2);
        }
        return false;
      });

      expect(bannerFinder, findsOneWidget);

      final container = tester.widget<Container>(bannerFinder);
      final deco = container.decoration as BoxDecoration;
      expect(deco.color, const Color(0xFFFEE2E2));
      final border = deco.border as Border;
      expect(border.top.color, const Color(0xFFF87171));
      expect(deco.borderRadius, BorderRadius.circular(6.0));

      final text = tester.widget<Text>(find.text('Bitte alle Pflichtfelder ausfüllen.'));
      expect(text.style?.color, const Color(0xFF991B1B));
    });

    testWidgets('error banner persists if subsequent submission fails form validation',
        (tester) async {
      final auth = AuthProvider();
      await tester.pumpWidget(_buildTestApp(auth));
      await tester.pumpAndSettle();

      // Set initial error banner via provider
      auth.login(email: '', password: '', host: '', port: 993);
      await tester.pump();
      expect(find.text('Bitte alle Pflichtfelder ausfüllen.'), findsOneWidget);

      // Tap submit with empty form fields -> validation fails -> auth.login not called
      await tester.tap(find.text('Mit Postfach verbinden'));
      await tester.pumpAndSettle();

      // Error banner remains visible
      expect(find.text('Bitte alle Pflichtfelder ausfüllen.'), findsOneWidget);
    });

    testWidgets('calling auth.clearError() dismisses error banner', (tester) async {
      final auth = AuthProvider();
      await tester.pumpWidget(_buildTestApp(auth));
      await tester.pumpAndSettle();

      auth.login(email: '', password: '', host: '', port: 993);
      await tester.pump();
      expect(find.text('Bitte alle Pflichtfelder ausfüllen.'), findsOneWidget);

      // Programmatic dismissal
      auth.clearError();
      await tester.pump();
      expect(find.text('Bitte alle Pflichtfelder ausfüllen.'), findsNothing);
    });
  });

  group('LoginScreen Challenge 4: Touch Target Sizes (>= 46-48dp)', () {
    testWidgets('primary action button height is >= 46dp', (tester) async {
      final auth = AuthProvider();
      await tester.pumpWidget(_buildTestApp(auth));
      await tester.pumpAndSettle();

      final buttonFinder = find.widgetWithText(ElevatedButton, 'Mit Postfach verbinden');
      expect(buttonFinder, findsOneWidget);

      final size = tester.getSize(buttonFinder);
      expect(size.height, greaterThanOrEqualTo(46.0));
    });

    testWidgets('text form fields meet ergonomic height requirements (>= 44-48dp)',
        (tester) async {
      final auth = AuthProvider();
      await tester.pumpWidget(_buildTestApp(auth));
      await tester.pumpAndSettle();

      final emailFinder = find.widgetWithText(TextFormField, 'name@domain.de');
      final emailSize = tester.getSize(emailFinder);
      expect(emailSize.height, greaterThanOrEqualTo(44.0));

      final hostFinder = find.widgetWithText(TextFormField, 'imap.ionos.de');
      final hostSize = tester.getSize(hostFinder);
      expect(hostSize.height, greaterThanOrEqualTo(44.0));
    });

    testWidgets('password visibility toggle icon button touch target is >= 48dp',
        (tester) async {
      final auth = AuthProvider();
      await tester.pumpWidget(_buildTestApp(auth));
      await tester.pumpAndSettle();

      final iconButtonFinder = find.byWidgetPredicate(
          (w) => w is IconButton && w.tooltip != 'Server-URL anpassen');
      expect(iconButtonFinder, findsOneWidget);

      final size = tester.getSize(iconButtonFinder);
      expect(size.width, greaterThanOrEqualTo(48.0));
      expect(size.height, greaterThanOrEqualTo(48.0));
    });

    testWidgets('settings icon button in app bar touch target is >= 48dp',
        (tester) async {
      final auth = AuthProvider();
      await tester.pumpWidget(_buildTestApp(auth));
      await tester.pumpAndSettle();

      final settingsFinder = find.byIcon(Icons.settings_outlined);
      expect(settingsFinder, findsOneWidget);

      final size = tester.getSize(find.ancestor(
        of: settingsFinder,
        matching: find.byType(IconButton),
      ));
      expect(size.width, greaterThanOrEqualTo(48.0));
      expect(size.height, greaterThanOrEqualTo(48.0));
    });

    testWidgets('server URL footer indicator touch target inspection',
        (tester) async {
      final auth = AuthProvider();
      await tester.pumpWidget(_buildTestApp(auth));
      await tester.pumpAndSettle();

      final footerFinder = find.textContaining('Server:');
      expect(footerFinder, findsOneWidget);

      final size = tester.getSize(footerFinder);
      // Text alone without padding is compact (~11-16dp height)
      expect(size.height, lessThan(30.0));
    });
  });

  group('LoginScreen Challenge 5: Viewport Responsiveness & Keyboard Overflow', () {
    testWidgets('zero RenderFlex overflow on compact 360 x 640 dp display',
        (tester) async {
      tester.view.physicalSize = const Size(360, 640);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final auth = AuthProvider();
      await tester.pumpWidget(_buildTestApp(auth));
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.text('IMAP-Zugangsdaten eingeben'), findsOneWidget);
    });

    testWidgets('zero RenderFlex overflow when keyboard is open (360x640 with 280dp insets)',
        (tester) async {
      tester.view.physicalSize = const Size(360, 640);
      tester.view.devicePixelRatio = 1.0;
      // Simulate soft keyboard taking 280dp of bottom space
      tester.view.viewInsets = const FakeViewPadding(bottom: 280.0);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetViewInsets);

      final auth = AuthProvider();
      await tester.pumpWidget(_buildTestApp(auth));
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);

      // Verify that the view can scroll smoothly under keyboard
      await tester.drag(find.byType(SingleChildScrollView), const Offset(0, -150));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });

    testWidgets('zero RenderFlex overflow under keyboard WITH error banner and validation errors',
        (tester) async {
      tester.view.physicalSize = const Size(360, 640);
      tester.view.devicePixelRatio = 1.0;
      tester.view.viewInsets = const FakeViewPadding(bottom: 280.0);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetViewInsets);

      final auth = AuthProvider();
      await tester.pumpWidget(_buildTestApp(auth));
      await tester.pumpAndSettle();

      // Clear host and port to trigger all 4 validation errors
      await tester.enterText(find.widgetWithText(TextFormField, 'imap.ionos.de'), '');
      await tester.enterText(find.widgetWithText(TextFormField, '993'), '');
      await tester.pumpAndSettle();

      // Trigger submit to display validation error labels on all 4 fields
      await tester.tap(find.text('Mit Postfach verbinden'));
      await tester.pumpAndSettle();

      // Also trigger error banner
      auth.login(email: '', password: '', host: '', port: 993);
      await tester.pump();

      expect(tester.takeException(), isNull);

      // Verify scrollable under maximum vertical stress
      await tester.drag(find.byType(SingleChildScrollView), const Offset(0, -200));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });

    testWidgets('zero RenderFlex overflow on ultra-compact 320 x 480 dp display',
        (tester) async {
      tester.view.physicalSize = const Size(320, 480);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final auth = AuthProvider();
      await tester.pumpWidget(_buildTestApp(auth));
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
    });
  });
}
