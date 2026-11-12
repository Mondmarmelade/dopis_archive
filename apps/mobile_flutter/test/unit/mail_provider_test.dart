import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:dopis_mobile/models/email_summary.dart';
import 'package:dopis_mobile/providers/mail_provider.dart';
import 'package:dopis_mobile/services/api_service.dart';

void main() {
  group('MailProvider Unit Tests', () {
    test('initial state has default inbox folder, empty emails and 0 unread', () {
      final provider = MailProvider();
      expect(provider.currentFolder, 'inbox');
      expect(provider.currentFolderDisplayName, 'Posteingang');
      expect(provider.emails, isEmpty);
      expect(provider.isLoading, isFalse);
      expect(provider.isRefreshing, isFalse);
      expect(provider.isSyncing, isFalse);
      expect(provider.errorMessage, isNull);
      expect(provider.hasError, isFalse);
      expect(provider.unreadCount, 0);
      expect(provider.inboxUnreadCount, 0);
    });

    test('fetchEmails populates emails and computes unread count correctly', () async {
      final mockClient = MockClient((request) async {
        expect(request.url.path, contains('/api/emails'));
        expect(request.url.queryParameters['folder'], 'inbox');
        return http.Response(
          jsonEncode({
            'account': 'user@domain.de',
            'folder': 'inbox',
            'emails': [
              {
                'id': '101',
                'seq': 101,
                'uid': 101,
                'name': 'Max Mustermann',
                'email': 'max@example.de',
                'subject': 'Erste E-Mail',
                'date': '2026-09-03T10:00:00Z',
                'read': false,
                'flagged': true,
                'snippet': 'Hallo Welt',
              },
              {
                'id': '102',
                'seq': 102,
                'uid': 102,
                'name': 'Anna Schmidt',
                'email': 'anna@example.de',
                'subject': 'Zweite E-Mail',
                'date': '2026-09-03T09:00:00Z',
                'read': true,
                'flagged': false,
                'snippet': 'Guten Tag',
              },
            ],
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final api = ApiService(client: mockClient, authToken: 'fake-token');
      final provider = MailProvider(apiService: api);

      final future = provider.fetchEmails();
      expect(provider.isLoading, isTrue);

      await future;

      expect(provider.isLoading, isFalse);
      expect(provider.emails.length, 2);
      expect(provider.unreadCount, 1);
      expect(provider.inboxUnreadCount, 1);
      expect(provider.emails.first.subject, 'Erste E-Mail');
      expect(provider.emails.first.isFlagged, isTrue);
      expect(provider.errorMessage, isNull);
    });

    test('fetchEmails handles server error gracefully and retains message', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({'error': 'IMAP server temporarily unreachable'}),
          502,
          headers: {'content-type': 'application/json'},
        );
      });

      final api = ApiService(client: mockClient, authToken: 'fake-token');
      final provider = MailProvider(apiService: api);

      await provider.fetchEmails();

      expect(provider.isLoading, isFalse);
      expect(provider.emails, isEmpty);
      expect(provider.errorMessage, isNotNull);
      expect(provider.errorMessage,
          contains('Verbindung zum IMAP-Mailserver fehlgeschlagen'));
    });

    test('selectFolder updates currentFolder and restores cached emails via SWR', () async {
      final mockClient = MockClient((request) async {
        final folder = request.url.queryParameters['folder'] ?? 'inbox';
        return http.Response(
          jsonEncode({
            'emails': [
              {
                'id': '1',
                'seq': 1,
                'uid': 1,
                'name': 'Sender $folder',
                'email': 'sender@test.de',
                'subject': 'Mail in $folder',
                'date': '2026-09-03T10:00:00Z',
                'read': true,
                'flagged': false,
              },
            ],
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final api = ApiService(client: mockClient, authToken: 'fake-token');
      final provider = MailProvider(apiService: api);

      // Load inbox
      await provider.fetchEmails();
      expect(provider.emails.first.subject, 'Mail in inbox');

      // Switch to sent
      await provider.selectFolder('sent');
      expect(provider.currentFolder, 'sent');
      expect(provider.currentFolderDisplayName, 'Gesendet');
      expect(provider.emails.first.subject, 'Mail in sent');

      // Switch back to inbox (instantly displays cached data)
      provider.selectFolder('inbox');
      expect(provider.currentFolder, 'inbox');
      expect(provider.emails.first.subject, 'Mail in inbox');
    });

    test('toggleStar optimistically updates local email and rolls back on failure', () async {
      bool shouldFail = false;
      final mockClient = MockClient((request) async {
        if (shouldFail) {
          return http.Response('Internal error', 500);
        }
        return http.Response(
            jsonEncode({'success': true, 'seq': 42, 'flagged': true}), 200,
            headers: {'content-type': 'application/json'});
      });

      final api = ApiService(client: mockClient, authToken: 'fake-token');
      final provider = MailProvider(apiService: api);

      // Seed initial email
      final testEmail = EmailSummary(
        id: '42',
        seq: 42,
        uid: 42,
        name: 'Max',
        email: 'max@test.de',
        subject: 'Test Star',
        date: DateTime.now(),
        read: true,
        flagged: false,
      );
      provider.seedEmailsForTesting('inbox', [testEmail]);

      expect(provider.emails.first.flagged, isFalse);

      // Optimistic star update (success)
      final starFuture = provider.toggleStar(42);
      expect(provider.emails.first.flagged, isTrue); // Optimistic flip
      await starFuture;
      expect(provider.emails.first.flagged, isTrue);

      // Optimistic unstar with API failure -> rollback
      shouldFail = true;
      try {
        await provider.toggleStar(42);
      } catch (_) {}
      expect(provider.emails.first.flagged, isTrue); // Rolled back to true
    });

    test('toggleRead optimistically updates read status and unread counter', () async {
      bool shouldFail = false;
      final mockClient = MockClient((request) async {
        if (shouldFail) {
          return http.Response('Internal error', 500);
        }
        return http.Response(
            jsonEncode({'success': true, 'seq': 99, 'seen': true}), 200,
            headers: {'content-type': 'application/json'});
      });

      final api = ApiService(client: mockClient, authToken: 'fake-token');
      final provider = MailProvider(apiService: api);

      final unreadItem = EmailSummary(
        id: '99',
        seq: 99,
        uid: 99,
        name: 'Anna',
        email: 'anna@test.de',
        subject: 'Test Read',
        date: DateTime.now(),
        read: false,
        flagged: false,
      );
      provider.seedEmailsForTesting('inbox', [unreadItem]);

      expect(provider.unreadCount, 1);
      expect(provider.emails.first.read, isFalse);

      // Mark as read optimistically
      final readFuture = provider.toggleRead(99);
      expect(provider.emails.first.read, isTrue);
      expect(provider.unreadCount, 0);
      await readFuture;
      expect(provider.emails.first.read, isTrue);

      // Rollback on failure
      shouldFail = true;
      try {
        await provider.toggleRead(99);
      } catch (_) {}
      expect(provider.emails.first.read, isTrue); // Reverted back
    });

    test('archiveEmail and trashEmail remove emails optimistically and roll back on error', () async {
      bool shouldFail = false;
      final mockClient = MockClient((request) async {
        if (shouldFail) return http.Response('Error', 500);
        return http.Response(jsonEncode({'success': true}), 200,
            headers: {'content-type': 'application/json'});
      });

      final api = ApiService(client: mockClient, authToken: 'fake-token');
      final provider = MailProvider(apiService: api);

      final email1 = EmailSummary(
        id: '1',
        seq: 1,
        uid: 1,
        name: 'A',
        email: 'a@test.de',
        subject: 'Mail 1',
        date: DateTime.now(),
        read: true,
        flagged: false,
      );
      final email2 = EmailSummary(
        id: '2',
        seq: 2,
        uid: 2,
        name: 'B',
        email: 'b@test.de',
        subject: 'Mail 2',
        date: DateTime.now(),
        read: true,
        flagged: false,
      );

      provider.seedEmailsForTesting('inbox', [email1, email2]);
      expect(provider.emails.length, 2);

      // Archive email 1
      await provider.archiveEmail(1);
      expect(provider.emails.length, 1);
      expect(provider.emails.first.seq, 2);

      // Trash email 2 with failure -> rolls back
      shouldFail = true;
      try {
        await provider.trashEmail(2);
      } catch (_) {}
      expect(provider.emails.length, 1);
      expect(provider.emails.first.seq, 2);
    });

    test('client-side search and unread filter correctly prune filteredEmails', () {
      final provider = MailProvider();
      final e1 = EmailSummary(
        id: '1',
        seq: 1,
        uid: 1,
        name: 'Rechnung',
        email: 'billing@firma.de',
        subject: 'Ihre Rechnung für September',
        date: DateTime.now(),
        read: false,
        flagged: false,
        snippet: 'Vielen Dank für Ihre Bestellung.',
      );
      final e2 = EmailSummary(
        id: '2',
        seq: 2,
        uid: 2,
        name: 'Team Newsletter',
        email: 'news@internal.de',
        subject: 'Wöchentliches Update',
        date: DateTime.now(),
        read: true,
        flagged: false,
        snippet: 'Das sind die Neuigkeiten der Woche.',
      );

      provider.seedEmailsForTesting('inbox', [e1, e2]);
      expect(provider.filteredEmails.length, 2);

      // Search query
      provider.setSearchQuery('Rechnung');
      expect(provider.filteredEmails.length, 1);
      expect(provider.filteredEmails.first.seq, 1);

      provider.setSearchQuery('');
      // Filter tab 'unread'
      provider.setFilterTab('unread');
      expect(provider.filteredEmails.length, 1);
      expect(provider.filteredEmails.first.seq, 1);

      provider.setFilterTab('all');
      expect(provider.filteredEmails.length, 2);
    });

    test('clearAll wipes all cached data and resets state', () {
      final provider = MailProvider();
      provider.seedEmailsForTesting('inbox', [
        EmailSummary(
          id: '1',
          seq: 1,
          uid: 1,
          name: 'Test',
          email: 'test@de.de',
          subject: 'Betreff',
          date: DateTime.now(),
          read: false,
          flagged: false,
        )
      ]);
      expect(provider.emails.length, 1);

      provider.clearAll();
      expect(provider.emails, isEmpty);
      expect(provider.currentFolder, 'inbox');
      expect(provider.isLoading, isFalse);
      expect(provider.unreadCount, 0);
    });
  });
}
