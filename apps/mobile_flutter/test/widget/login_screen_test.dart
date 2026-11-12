import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:dopis_mobile/providers/auth_provider.dart';
import 'package:dopis_mobile/screens/login_screen.dart';
import 'package:dopis_mobile/widgets/dopis_logo.dart';

Widget _createTestWidget(AuthProvider authProvider) {
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

  group('LoginScreen Widget Rendering & Interaction', () {
    testWidgets('renders all required elements matching login.astro',
        (tester) async {
      final auth = AuthProvider();
      await tester.pumpWidget(_createTestWidget(auth));
      await tester.pumpAndSettle();

      // 1. Dopis Logo
      expect(find.byType(DopisLogo), findsOneWidget);

      // 2. Headline
      expect(find.text('IMAP-Zugangsdaten eingeben'), findsOneWidget);

      // 3. Four input field labels
      expect(find.text('Benutzername / E-Mail:'), findsOneWidget);
      expect(find.text('Passwort:'), findsOneWidget);
      expect(find.text('IMAP-Server (Host):'), findsOneWidget);
      expect(find.text('Port:'), findsOneWidget);

      // 4. Default values prefilled
      expect(find.text('imap.ionos.de'), findsOneWidget);
      expect(find.text('993'), findsOneWidget);

      // 5. Connect button
      expect(find.text('Mit Postfach verbinden'), findsOneWidget);

      // 6. Discreet server settings button
      expect(find.byIcon(Icons.settings_outlined), findsOneWidget);

      // 7. Active server indicator
      expect(find.textContaining('Server:'), findsOneWidget);
    });

    testWidgets('displays red error banner when errorMessage is present',
        (tester) async {
      final auth = AuthProvider();
      await tester.pumpWidget(_createTestWidget(auth));
      await tester.pumpAndSettle();

      // Error banner absent initially
      expect(
          find.text(
              'IMAP-Anmeldung fehlgeschlagen. Bitte prüfe E-Mail-Adresse, Passwort und Server-Einstellungen.'),
          findsNothing);

      // Trigger error state
      auth.login(email: '', password: '', host: '', port: 993);
      await tester.pump();

      expect(find.text('Bitte alle Pflichtfelder ausfüllen.'), findsOneWidget);
    });

    testWidgets('form validation triggers on empty submit', (tester) async {
      final auth = AuthProvider();
      await tester.pumpWidget(_createTestWidget(auth));
      await tester.pumpAndSettle();

      // Tap submit button without entering email/password
      await tester.tap(find.text('Mit Postfach verbinden'));
      await tester.pumpAndSettle();

      expect(find.text('Bitte Benutzername / E-Mail eingeben'), findsOneWidget);
      expect(find.text('Bitte Passwort eingeben'), findsOneWidget);
    });

    testWidgets('opens discreet server URL dialog on settings icon tap',
        (tester) async {
      final auth = AuthProvider();
      await tester.pumpWidget(_createTestWidget(auth));
      await tester.pumpAndSettle();

      await tester.tap(find.byIcon(Icons.settings_outlined));
      await tester.pumpAndSettle();

      expect(find.text('Server-URL anpassen'), findsOneWidget);
      expect(find.text('Standard (LAN)'), findsOneWidget);
      expect(find.text('Localhost'), findsOneWidget);
      expect(find.text('Android Emulator'), findsOneWidget);
      expect(find.text('Speichern'), findsOneWidget);
      expect(find.text('Abbrechen'), findsOneWidget);

      // Tap preset 'Localhost'
      await tester.tap(find.text('Localhost'));
      await tester.pumpAndSettle();

      // Tap 'Speichern'
      await tester.tap(find.text('Speichern'));
      await tester.pumpAndSettle();

      expect(auth.baseUrl, 'http://localhost:4321');
    });

    testWidgets('renders cleanly on 360x640 compact viewport without overflow',
        (tester) async {
      tester.view.physicalSize = const Size(360, 640);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final auth = AuthProvider();
      await tester.pumpWidget(_createTestWidget(auth));
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.text('IMAP-Zugangsdaten eingeben'), findsOneWidget);
      expect(find.text('Mit Postfach verbinden'), findsOneWidget);
    });
  });
}
