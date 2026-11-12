import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:dopis_mobile/models/email_summary.dart';
import 'package:dopis_mobile/models/email_detail.dart';
import 'package:dopis_mobile/models/user_session.dart';
import 'package:dopis_mobile/models/ai_analysis.dart';
import 'package:dopis_mobile/services/api_service.dart';
import 'package:dopis_mobile/services/storage_service.dart';
import 'package:dopis_mobile/providers/auth_provider.dart';
import 'package:dopis_mobile/providers/mail_provider.dart';
import 'package:dopis_mobile/screens/mail_list_screen.dart';
import 'package:dopis_mobile/screens/email_detail_screen.dart';

void main() {
  setUp(() {
    GoogleFonts.config.allowRuntimeFetching = false;
    SharedPreferences.setMockInitialValues({});
  });

  group('Tier 3: Pairwise Combinatorial & Cross-Feature Tests', () {
    test('Pairwise 1: AuthProvider + StorageService session lifecycle', () async {
      final storage = StorageService();
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'token': 'pair-token-1',
            'expiresAt': '2026-09-17T12:00:00Z',
            'user': {'email': 'auto@dopis.de', 'host': 'imap.ionos.de'},
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final auth = AuthProvider(
        apiService: ApiService(client: mockClient),
        storageService: storage,
      );

      // 1. Perform login
      final success = await auth.login(
        email: 'auto@dopis.de',
        password: 'pwd',
        host: 'imap.ionos.de',
        port: 993,
      );
      expect(success, isTrue);
      expect(auth.isAuthenticated, isTrue);

      // 2. New instance executes tryAutoLogin from SharedPreferences
      final freshAuth = AuthProvider(
        apiService: ApiService(client: mockClient),
        storageService: storage,
      );
      final autoSuccess = await freshAuth.tryAutoLogin();
      expect(autoSuccess, isTrue);
      expect(freshAuth.isAuthenticated, isTrue);
      expect(freshAuth.userEmail, 'auto@dopis.de');

      // 3. Logout clears SharedPreferences
      await freshAuth.logout();
      expect(freshAuth.isAuthenticated, isFalse);
      final saved = await storage.getSession();
      expect(saved, isNull);
    });

    test('Pairwise 2: Multi-folder SWR Caching + Instant Switching', () async {
      final mockClient = MockClient((request) async {
        final folder = request.url.queryParameters['folder'] ?? 'inbox';
        return http.Response(
          jsonEncode({
            'emails': [
              {
                'id': 'pair-$folder',
                'seq': folder.hashCode.abs() % 1000,
                'uid': 1,
                'name': 'Sender $folder',
                'email': 's@dopis.de',
                'subject': 'Subject in $folder',
                'date': '2026-09-03T12:00:00Z',
                'read': false,
                'flagged': false,
              }
            ]
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final provider = MailProvider(apiService: ApiService(client: mockClient));

      // Fetch inbox
      await provider.selectFolder('inbox');
      expect(provider.emails.first.subject, 'Subject in inbox');

      // Fetch sent
      await provider.selectFolder('sent');
      expect(provider.emails.first.subject, 'Subject in sent');

      // Switch back to inbox: immediately available
      provider.selectFolder('inbox');
      expect(provider.emails.first.subject, 'Subject in inbox');
    });

    testWidgets('Pairwise 3: Detail View Star Toggle propagates to MailListScreen model',
        (tester) async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({'success': true, 'seq': 42, 'flagged': true}),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final mail = MailProvider(apiService: ApiService(client: mockClient));
      final auth = AuthProvider();

      final summary = EmailSummary(
        id: '42',
        seq: 42,
        uid: 42,
        name: 'Sync Test',
        email: 'sync@test.de',
        subject: 'Sync Subject',
        date: DateTime.now(),
        read: true,
        flagged: false,
      );

      mail.seedEmailsForTesting('inbox', [summary]);
      expect(mail.emails.first.isFlagged, isFalse);

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider.value(value: auth),
            ChangeNotifierProvider.value(value: mail),
          ],
          child: MaterialApp(
            home: EmailDetailScreen(emailSummary: summary),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Tap star button in detail screen
      await tester.tap(find.byTooltip('Markieren'));
      await tester.pumpAndSettle();

      // Verify MailProvider model was updated
      expect(mail.emails.first.isFlagged, isTrue);
    });

    testWidgets('Pairwise 4: Unread Mail auto-marked as read on open decrements unreadCount',
        (tester) async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({'success': true, 'seq': 77, 'seen': true}),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final mail = MailProvider(apiService: ApiService(client: mockClient));
      final auth = AuthProvider();

      final unreadMail = EmailSummary(
        id: '77',
        seq: 77,
        uid: 77,
        name: 'Unread User',
        email: 'unread@user.de',
        subject: 'Unread Notification',
        date: DateTime.now(),
        read: false,
        flagged: false,
      );

      mail.seedEmailsForTesting('inbox', [unreadMail]);
      expect(mail.unreadCount, 1);

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider.value(value: auth),
            ChangeNotifierProvider.value(value: mail),
          ],
          child: MaterialApp(
            home: EmailDetailScreen(emailSummary: unreadMail),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Auto-marked as read
      expect(mail.unreadCount, 0);
      expect(mail.emails.first.read, isTrue);
    });

    test('Pairwise 5: Search Query + Unread Tab filtering simultaneously', () {
      final provider = MailProvider();
      final e1 = EmailSummary(
        id: '1',
        seq: 1,
        uid: 1,
        name: 'Rechnung GmbH',
        email: 'r@gmbh.de',
        subject: 'Rechnung für Server',
        date: DateTime.now(),
        read: false,
        flagged: false,
      );
      final e2 = EmailSummary(
        id: '2',
        seq: 2,
        uid: 2,
        name: 'Rechnung Privat',
        email: 'r@privat.de',
        subject: 'Rechnung bezahlt',
        date: DateTime.now(),
        read: true,
        flagged: false,
      );
      final e3 = EmailSummary(
        id: '3',
        seq: 3,
        uid: 3,
        name: 'Newsletter',
        email: 'n@n.de',
        subject: 'Wochenupdate',
        date: DateTime.now(),
        read: false,
        flagged: false,
      );

      provider.seedEmailsForTesting('inbox', [e1, e2, e3]);
      expect(provider.filteredEmails.length, 3);

      // Apply search "Rechnung"
      provider.setSearchQuery('Rechnung');
      expect(provider.filteredEmails.length, 2);

      // Also apply filterTab 'unread'
      provider.setFilterTab('unread');
      expect(provider.filteredEmails.length, 1);
      expect(provider.filteredEmails.first.seq, 1);
    });

    test('Pairwise 6: AI Analysis Action Item toggling preserves checklist state', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'category': 'Wichtig',
            'summary': ['Review needed.'],
            'actionItems': [
              {'task': 'Dokument signieren', 'completed': false},
            ],
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final provider = MailProvider(apiService: ApiService(client: mockClient));
      final detail = EmailDetail(
        id: 'ai-1',
        seq: 88,
        uid: 88,
        subject: 'AI Task Test',
        from: const EmailRecipient(name: 'Sender', address: 's@s.de'),
        to: const [],
        cc: const [],
        date: DateTime.now(),
        text: 'Please review and sign.',
        read: true,
        flagged: false,
      );

      final analysis = await provider.triggerAiAnalysis(detail);
      expect(analysis, isNotNull);
      expect(provider.aiCache.containsKey(88), isTrue);
      expect(provider.aiCache[88]?.actionItems.first.completed, isFalse);

      provider.toggleActionItem(88, 0);
      expect(provider.aiCache[88]?.actionItems.first.completed, isTrue);

      provider.toggleActionItem(88, 0);
      expect(provider.aiCache[88]?.actionItems.first.completed, isFalse);
    });
  });
}
