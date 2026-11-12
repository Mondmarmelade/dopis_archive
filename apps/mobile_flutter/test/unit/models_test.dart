import 'package:flutter_test/flutter_test.dart';
import 'package:dopis_mobile/models/user_session.dart';
import 'package:dopis_mobile/models/email_summary.dart';
import 'package:dopis_mobile/models/email_detail.dart';
import 'package:dopis_mobile/models/ai_analysis.dart';

void main() {
  group('UserSession Model', () {
    test('serializes and deserializes correctly', () {
      final session = UserSession(
        token: 'test-token-xyz',
        email: 'user@domain.de',
        host: 'imap.ionos.de',
        port: 993,
        expiresAt: DateTime.parse('2026-10-01T00:00:00.000Z'),
      );

      final json = session.toJson();
      final recovered = UserSession.fromJson(json);

      expect(recovered.token, 'test-token-xyz');
      expect(recovered.email, 'user@domain.de');
      expect(recovered.host, 'imap.ionos.de');
      expect(recovered.port, 993);
      expect(recovered.isExpired, isFalse);
      expect(recovered.isValid, isTrue);
      expect(recovered, equals(session));
    });

    test('isExpired returns true for past timestamp', () {
      final expiredSession = UserSession(
        token: 'expired',
        email: 'user@domain.de',
        host: 'imap.ionos.de',
        port: 993,
        expiresAt: DateTime.now().subtract(const Duration(hours: 1)),
      );

      expect(expiredSession.isExpired, isTrue);
      expect(expiredSession.isValid, isFalse);
    });

    test('fromLoginResponse constructs session correctly', () {
      final loginData = {
        'token': 'login-token-123',
        'expiresAt': '2026-09-17T12:00:00.000Z',
        'user': {
          'email': 'nico@dopis.de',
          'host': 'imap.ionos.de',
        },
      };

      final session = UserSession.fromLoginResponse(loginData, port: 993);
      expect(session.token, 'login-token-123');
      expect(session.email, 'nico@dopis.de');
      expect(session.host, 'imap.ionos.de');
      expect(session.port, 993);
      expect(session.isExpired, isFalse);
    });

    test('copyWith creates modified copy', () {
      final session = UserSession(
        token: 'tok',
        email: 'a@b.c',
        host: 'h',
        port: 993,
        expiresAt: DateTime.now().add(const Duration(days: 1)),
      );

      final copy = session.copyWith(port: 143, host: 'newhost');
      expect(copy.port, 143);
      expect(copy.host, 'newhost');
      expect(copy.token, 'tok');
    });
  });

  group('EmailSummary Model', () {
    test('parses Astro backend emails JSON accurately', () {
      final json = {
        'id': '42',
        'seq': 42,
        'uid': 1042,
        'name': 'Max Mustermann',
        'email': 'max@mustermann.de',
        'from': {'name': 'Max Mustermann', 'address': 'max@mustermann.de'},
        'subject': 'Projekt-Update September',
        'date': '2026-09-03T12:00:00.000Z',
        'read': false,
        'isUnread': true,
        'flagged': true,
        'isFlagged': true,
        'flags': [r'\Seen', r'\Flagged'],
        'snippet': 'Hallo Team, hier ist das Update...',
      };

      final summary = EmailSummary.fromJson(json);
      expect(summary.seq, 42);
      expect(summary.uid, 1042);
      expect(summary.subject, 'Projekt-Update September');
      expect(summary.isUnread, isTrue);
      expect(summary.read, isFalse);
      expect(summary.isFlagged, isTrue);
      expect(summary.flagged, isTrue);
      expect(summary.senderName, 'Max Mustermann');
      expect(summary.name, 'Max Mustermann');
      expect(summary.fromAddress, 'max@mustermann.de');
      expect(summary.flags, contains(r'\Flagged'));
      expect(summary.snippet, 'Hallo Team, hier ist das Update...');
    });

    test('handles fallback values and coercion gracefully', () {
      final json = {
        'seq': '15',
        'from': {'name': '', 'address': 'unknown@domain.com'},
        'subject': '',
      };

      final summary = EmailSummary.fromJson(json);
      expect(summary.seq, 15);
      expect(summary.uid, 15);
      expect(summary.name, 'unknown@domain.com');
      expect(summary.subject, '(Kein Betreff)');
      expect(summary.read, isFalse);
      expect(summary.flagged, isFalse);
    });

    test('copyWith produces updated instance', () {
      final original = EmailSummary(
        id: '1',
        seq: 1,
        uid: 101,
        name: 'Sender',
        email: 's@d.com',
        subject: 'Hi',
        date: DateTime.now(),
        read: false,
        flagged: false,
      );

      final updated = original.copyWith(read: true, flagged: true);
      expect(updated.read, isTrue);
      expect(updated.isUnread, isFalse);
      expect(updated.flagged, isTrue);
      expect(updated.seq, 1);
    });
  });

  group('EmailDetail Model', () {
    test('parses full detail response including attachments', () {
      final json = {
        'id': '42',
        'seq': 42,
        'uid': 1042,
        'subject': 'Rechnung Nr. 12345',
        'from': {'name': 'Buchhaltung', 'address': 'rechnung@shop.de'},
        'to': [
          {'name': 'Kunde', 'address': 'kunde@domain.de'}
        ],
        'cc': [],
        'date': '2026-09-03T12:00:00.000Z',
        'html': '<p>Vielen Dank für Ihren Einkauf!</p>',
        'text': 'Vielen Dank für Ihren Einkauf!',
        'attachments': [
          {
            'filename': 'Rechnung.pdf',
            'mimeType': 'application/pdf',
            'disposition': 'attachment',
            'size': 2048,
          },
          {
            'filename': 'Logo.png',
            'mimeType': 'image/png',
            'disposition': 'inline',
            'size': 1500000,
          },
        ],
        'flags': [r'\Seen'],
        'read': true,
        'flagged': false,
      };

      final detail = EmailDetail.fromJson(json);
      expect(detail.seq, 42);
      expect(detail.subject, 'Rechnung Nr. 12345');
      expect(detail.name, 'Buchhaltung');
      expect(detail.email, 'rechnung@shop.de');
      expect(detail.hasHtml, isTrue);
      expect(detail.hasText, isTrue);
      expect(detail.hasAttachments, isTrue);
      expect(detail.attachments.length, 2);
      expect(detail.attachments[0].formattedSize, '2.0 KB');
      expect(detail.attachments[1].formattedSize, '1.4 MB');
      expect(detail.read, isTrue);
      expect(detail.flagged, isFalse);
    });
  });

  group('AiAnalysisResult & ActionItem Models', () {
    test('parses AI analysis response with action items', () {
      final json = {
        'summary': [
          'Projektmeilenstein 1 erfolgreich vorbereitet.',
          'Review für morgen geplant.',
        ],
        'category': 'Geschäftlich',
        'tags': ['Projekt', 'Meilenstein'],
        'actionItems': [
          {'task': 'Code Review abschließen', 'due': '2026-09-04'},
          {'task': 'Tests ausführen', 'due': null},
        ],
        'paymentInfo': null,
        'orderInfo': null,
      };

      final result = AiAnalysisResult.fromJson(json);
      expect(result.summary.length, 2);
      expect(result.category, 'Geschäftlich');
      expect(result.tags, contains('Projekt'));
      expect(result.actionItems.length, 2);
      expect(result.actionItems[0].task, 'Code Review abschließen');
      expect(result.actionItems[0].completed, isFalse);

      final toggled = result.actionItems[0].copyWith(completed: true);
      expect(toggled.completed, isTrue);
    });

    test('parses payment and order info when present', () {
      final json = {
        'summary': ['Zahlungsbestätigung erhalten'],
        'category': 'Finanzen',
        'tags': ['Rechnung'],
        'actionItems': [],
        'paymentInfo': {
          'isPaymentReceipt': true,
          'provider': 'PayPal',
          'amount': '49,99 €',
          'transactionId': 'TX-98765',
        },
        'orderInfo': {
          'isOrder': true,
          'merchant': 'Online Shop GmbH',
          'orderId': 'ORD-1234',
        },
      };

      final result = AiAnalysisResult.fromJson(json);
      expect(result.paymentInfo?.provider, 'PayPal');
      expect(result.paymentInfo?.amount, '49,99 €');
      expect(result.orderInfo?.merchant, 'Online Shop GmbH');
      expect(result.orderInfo?.orderId, 'ORD-1234');
    });
  });
}
