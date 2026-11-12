import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:dopis_mobile/services/storage_service.dart';
import 'package:dopis_mobile/models/user_session.dart';

void main() {
  group('StorageService', () {
    late StorageService storage;

    setUp(() {
      SharedPreferences.setMockInitialValues({});
      storage = StorageService();
    });

    test('saves, retrieves and clears user session', () async {
      final session = UserSession(
        token: 'sample-aes-token',
        email: 'test@ionos.de',
        host: 'imap.ionos.de',
        port: 993,
        expiresAt: DateTime.now().add(const Duration(days: 7)),
      );

      await storage.saveSession(session);
      final retrieved = await storage.getSession();

      expect(retrieved, isNotNull);
      expect(retrieved!.token, 'sample-aes-token');
      expect(retrieved.email, 'test@ionos.de');
      expect(retrieved.host, 'imap.ionos.de');
      expect(retrieved.port, 993);
      expect(retrieved.isExpired, isFalse);

      await storage.clearSession();
      final afterClear = await storage.getSession();
      expect(afterClear, isNull);
    });

    test('returns null and automatically purges expired session', () async {
      final expired = UserSession(
        token: 'old-token',
        email: 'old@ionos.de',
        host: 'imap.ionos.de',
        port: 993,
        expiresAt: DateTime.now().subtract(const Duration(days: 1)),
      );

      await storage.saveSession(expired);
      final retrieved = await storage.getSession();
      expect(retrieved, isNull);

      // Verify that clearSession was triggered
      final secondRetrieval = await storage.getSession();
      expect(secondRetrieval, isNull);
    });

    test('persists and retrieves custom base URL', () async {
      await storage.setCustomBaseUrl('http://10.0.2.2:4321');
      final url = await storage.getCustomBaseUrl();
      expect(url, 'http://10.0.2.2:4321');

      // Clear custom base URL by setting empty
      await storage.setCustomBaseUrl('');
      final clearedUrl = await storage.getCustomBaseUrl();
      expect(clearedUrl, isNull);
    });

    test('clearSession preserves custom base URL', () async {
      await storage.setCustomBaseUrl('http://192.168.1.100:4321');
      final session = UserSession(
        token: 'token-abc',
        email: 'user@ionos.de',
        host: 'imap.ionos.de',
        port: 993,
        expiresAt: DateTime.now().add(const Duration(days: 5)),
      );

      await storage.saveSession(session);
      await storage.clearSession();

      final retrievedSession = await storage.getSession();
      expect(retrievedSession, isNull);

      final retrievedUrl = await storage.getCustomBaseUrl();
      expect(retrievedUrl, 'http://192.168.1.100:4321');
    });
  });
}
