import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:dopis_mobile/models/user_session.dart';
import 'package:dopis_mobile/providers/auth_provider.dart';
import 'package:dopis_mobile/services/api_service.dart';
import 'package:dopis_mobile/services/storage_service.dart';

void main() {
  group('AuthProvider State Transitions', () {
    late StorageService storage;

    setUp(() {
      SharedPreferences.setMockInitialValues({});
      storage = StorageService();
    });

    test('initial state is unauthenticated and idle', () {
      final provider = AuthProvider(storageService: storage);
      expect(provider.isAuthenticated, isFalse);
      expect(provider.isLoading, isFalse);
      expect(provider.errorMessage, isNull);
      expect(provider.session, isNull);
    });

    test('successful login updates session, isAuthenticated and clears error',
        () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'success': true,
            'token': 'valid-token',
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
        email: 'user@domain.de',
        password: 'password123',
        host: 'imap.ionos.de',
        port: 993,
      );

      expect(success, isTrue);
      expect(provider.isAuthenticated, isTrue);
      expect(provider.session?.token, 'valid-token');
      expect(provider.userEmail, 'user@domain.de');
      expect(provider.errorMessage, isNull);
      expect(provider.isLoading, isFalse);

      // Verify persisted to storage
      final storedSession = await storage.getSession();
      expect(storedSession?.token, 'valid-token');
    });

    test('failed login sets error banner and leaves unauthenticated', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'error':
                'IMAP authentication failed. Please verify your email, password, and host.'
          }),
          401,
          headers: {'content-type': 'application/json'},
        );
      });

      final api = ApiService(client: mockClient);
      final provider = AuthProvider(apiService: api, storageService: storage);

      final success = await provider.login(
        email: 'user@domain.de',
        password: 'wrong',
        host: 'imap.ionos.de',
        port: 993,
      );

      expect(success, isFalse);
      expect(provider.isAuthenticated, isFalse);
      expect(provider.errorMessage, isNotNull);
      expect(provider.errorMessage, contains('IMAP-Anmeldung fehlgeschlagen'));
      expect(provider.isLoading, isFalse);
    });

    test('empty inputs set error message without network call', () async {
      final provider = AuthProvider(storageService: storage);

      final success = await provider.login(
        email: '   ',
        password: '',
        host: 'imap.ionos.de',
        port: 993,
      );

      expect(success, isFalse);
      expect(provider.isAuthenticated, isFalse);
      expect(provider.errorMessage, 'Bitte alle Pflichtfelder ausfüllen.');
    });

    test('tryAutoLogin restores active session from storage', () async {
      final saved = UserSession(
        token: 'persisted-token-456',
        email: 'saved@ionos.de',
        host: 'imap.ionos.de',
        port: 993,
        expiresAt: DateTime.now().add(const Duration(days: 10)),
      );
      await storage.saveSession(saved);

      final provider = AuthProvider(storageService: storage);
      final autoLoginSuccess = await provider.tryAutoLogin();

      expect(autoLoginSuccess, isTrue);
      expect(provider.isAuthenticated, isTrue);
      expect(provider.session?.token, 'persisted-token-456');
      expect(provider.userEmail, 'saved@ionos.de');
    });

    test('tryAutoLogin rejects and purges expired session', () async {
      final expired = UserSession(
        token: 'expired-token',
        email: 'exp@ionos.de',
        host: 'imap.ionos.de',
        port: 993,
        expiresAt: DateTime.now().subtract(const Duration(days: 2)),
      );
      await storage.saveSession(expired);

      final provider = AuthProvider(storageService: storage);
      final autoLoginSuccess = await provider.tryAutoLogin();

      expect(autoLoginSuccess, isFalse);
      expect(provider.isAuthenticated, isFalse);
      expect(provider.session, isNull);
    });

    test('logout clears session and resets isAuthenticated', () async {
      final session = UserSession(
        token: 'active-token',
        email: 'user@ionos.de',
        host: 'imap.ionos.de',
        port: 993,
        expiresAt: DateTime.now().add(const Duration(days: 5)),
      );
      await storage.saveSession(session);

      final provider = AuthProvider(storageService: storage);
      await provider.tryAutoLogin();
      expect(provider.isAuthenticated, isTrue);

      await provider.logout();
      expect(provider.isAuthenticated, isFalse);
      expect(provider.session, isNull);

      final storedAfterLogout = await storage.getSession();
      expect(storedAfterLogout, isNull);
    });

    test('setBaseUrl updates baseUrl and persists to storage', () async {
      final provider = AuthProvider(storageService: storage);
      await provider.setBaseUrl('http://192.168.1.50:4321/');

      expect(provider.baseUrl, 'http://192.168.1.50:4321');
      final storedUrl = await storage.getCustomBaseUrl();
      expect(storedUrl, 'http://192.168.1.50:4321');
    });

    test('clearError resets error banner message', () {
      final provider = AuthProvider(storageService: storage);
      provider.login(email: '', password: '', host: '', port: 993);
      expect(provider.errorMessage, isNotNull);

      provider.clearError();
      expect(provider.errorMessage, isNull);
    });
  });
}
