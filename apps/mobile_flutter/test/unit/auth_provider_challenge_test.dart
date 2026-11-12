import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:dopis_mobile/providers/auth_provider.dart';
import 'package:dopis_mobile/services/api_service.dart';
import 'package:dopis_mobile/services/storage_service.dart';

void main() {
  group('AuthProvider Challenge 1: Empty and Whitespace Validation', () {
    late StorageService storage;

    setUp(() {
      SharedPreferences.setMockInitialValues({});
      storage = StorageService();
    });

    test('rejects empty and whitespace-only email', () async {
      final provider = AuthProvider(storageService: storage);

      // Empty string
      final resEmpty = await provider.login(
        email: '',
        password: 'password123',
        host: 'imap.ionos.de',
        port: 993,
      );
      expect(resEmpty, isFalse);
      expect(provider.errorMessage, 'Bitte alle Pflichtfelder ausfüllen.');

      // Whitespace string
      final resSpaces = await provider.login(
        email: '   \t  ',
        password: 'password123',
        host: 'imap.ionos.de',
        port: 993,
      );
      expect(resSpaces, isFalse);
      expect(provider.errorMessage, 'Bitte alle Pflichtfelder ausfüllen.');
    });

    test('rejects empty password', () async {
      final provider = AuthProvider(storageService: storage);

      final res = await provider.login(
        email: 'user@ionos.de',
        password: '',
        host: 'imap.ionos.de',
        port: 993,
      );
      expect(res, isFalse);
      expect(provider.errorMessage, 'Bitte alle Pflichtfelder ausfüllen.');
    });

    test('rejects empty and whitespace-only host', () async {
      final provider = AuthProvider(storageService: storage);

      final res = await provider.login(
        email: 'user@ionos.de',
        password: 'password123',
        host: '   ',
        port: 993,
      );
      expect(res, isFalse);
      expect(provider.errorMessage, 'Bitte alle Pflichtfelder ausfüllen.');
    });

    test('trims leading/trailing whitespace from email and host before sending',
        () async {
      late Map<String, dynamic> capturedPayload;

      final mockClient = MockClient((request) async {
        capturedPayload = jsonDecode(request.body) as Map<String, dynamic>;
        return http.Response(
          jsonEncode({
            'success': true,
            'token': 'trimmed-token',
            'expiresAt': '2026-09-17T12:00:00.000Z',
            'user': {'email': 'user@domain.de', 'host': 'imap.ionos.de'},
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final api = ApiService(client: mockClient);
      final provider = AuthProvider(apiService: api, storageService: storage);

      final success = await provider.login(
        email: '   user@domain.de   ',
        password: 'mypassword',
        host: '  imap.ionos.de  ',
        port: 993,
      );

      expect(success, isTrue);
      expect(capturedPayload['email'], 'user@domain.de');
      expect(capturedPayload['host'], 'imap.ionos.de');
      expect(provider.userEmail, 'user@domain.de');
    });
  });

  group('AuthProvider Challenge 2: Backend Port Error Handling', () {
    late StorageService storage;

    setUp(() {
      SharedPreferences.setMockInitialValues({});
      storage = StorageService();
    });

    test('maps backend invalid port error (400) to clear German message',
        () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({'error': 'Invalid port: must be between 1 and 65535'}),
          400,
          headers: {'content-type': 'application/json'},
        );
      });

      final api = ApiService(client: mockClient);
      final provider = AuthProvider(apiService: api, storageService: storage);

      final success = await provider.login(
        email: 'user@ionos.de',
        password: 'password123',
        host: 'imap.ionos.de',
        port: 70000,
      );

      expect(success, isFalse);
      expect(provider.errorMessage,
          'Ungültige Portnummer. Bitte einen Port zwischen 1 und 65535 angeben.');
    });

    test('maps IMAP server connection failure (502) to German message', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({'error': 'Failed to connect to IMAP host'}),
          502,
          headers: {'content-type': 'application/json'},
        );
      });

      final api = ApiService(client: mockClient);
      final provider = AuthProvider(apiService: api, storageService: storage);

      final success = await provider.login(
        email: 'user@ionos.de',
        password: 'password123',
        host: 'nonexistent.imap.de',
        port: 993,
      );

      expect(success, isFalse);
      expect(provider.errorMessage,
          'Verbindung zum IMAP-Mailserver fehlgeschlagen. Bitte Serveradresse und Port prüfen.');
    });
  });

  group('AuthProvider Challenge 3: Error Banner Lifecycle and Dismissal', () {
    late StorageService storage;

    setUp(() {
      SharedPreferences.setMockInitialValues({});
      storage = StorageService();
    });

    test('clearError resets errorMessage and notifies listeners', () {
      final provider = AuthProvider(storageService: storage);

      provider.login(email: '', password: '', host: '', port: 993);
      expect(provider.errorMessage, isNotNull);

      var notified = false;
      provider.addListener(() {
        notified = true;
      });

      provider.clearError();
      expect(provider.errorMessage, isNull);
      expect(notified, isTrue);
    });

    test('starting new login clears existing errorMessage immediately', () async {
      var callCount = 0;
      final mockClient = MockClient((request) async {
        callCount++;
        if (callCount == 1) {
          return http.Response(
            jsonEncode({'error': 'IMAP authentication failed'}),
            401,
            headers: {'content-type': 'application/json'},
          );
        }
        return http.Response(
          jsonEncode({
            'success': true,
            'token': 'new-token',
            'user': {'email': 'user@domain.de', 'host': 'imap.ionos.de'}
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final api = ApiService(client: mockClient);
      final provider = AuthProvider(apiService: api, storageService: storage);

      // 1st attempt: fails
      await provider.login(
        email: 'user@domain.de',
        password: 'bad',
        host: 'imap.ionos.de',
        port: 993,
      );
      expect(provider.errorMessage, isNotNull);

      // 2nd attempt: succeeds
      final success2 = await provider.login(
        email: 'user@domain.de',
        password: 'good',
        host: 'imap.ionos.de',
        port: 993,
      );

      expect(success2, isTrue);
      expect(provider.errorMessage, isNull);
    });

    test('logout resets errorMessage', () async {
      final provider = AuthProvider(storageService: storage);
      await provider.login(email: '', password: '', host: '', port: 993);
      expect(provider.errorMessage, isNotNull);

      await provider.logout();
      expect(provider.errorMessage, isNull);
    });
  });
}
