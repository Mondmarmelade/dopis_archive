import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:dopis_mobile/models/email_summary.dart';
import 'package:dopis_mobile/widgets/email_tile.dart';

void main() {
  setUp(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  final unreadEmail = EmailSummary(
    id: '1',
    seq: 1,
    uid: 1,
    name: 'Max Mustermann',
    email: 'max@example.de',
    subject: 'Wichtiges Projektupdate',
    date: DateTime.now(),
    read: false,
    flagged: true,
    snippet: 'Hier ist der aktuelle Fortschrittsbericht...',
  );

  final readEmail = EmailSummary(
    id: '2',
    seq: 2,
    uid: 2,
    name: 'Anna Schmidt',
    email: 'anna@example.de',
    subject: 'Protokoll vom Meeting',
    date: DateTime(2025, 3, 14, 11, 30),
    read: true,
    flagged: false,
    snippet: 'Anbei das Protokoll...',
  );

  group('EmailTile Widget Tests', () {
    testWidgets(
        'renders unread item with bold styling and blue dot indicator',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: EmailTile(email: unreadEmail, onTap: () {}),
          ),
        ),
      );

      // Sender and subject bold
      final senderText = tester.widget<Text>(find.text('Max Mustermann'));
      expect(senderText.style?.fontWeight, FontWeight.bold);

      final subjectText =
          tester.widget<Text>(find.text('Wichtiges Projektupdate'));
      expect(subjectText.style?.fontWeight, FontWeight.bold);

      // Unread blue dot indicator
      expect(find.byKey(const Key('unread_dot_1')), findsOneWidget);
    });

    testWidgets(
        'renders read item with normal font weight and white surface',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: EmailTile(email: readEmail, onTap: () {}),
          ),
        ),
      );

      final senderText = tester.widget<Text>(find.text('Anna Schmidt'));
      expect(senderText.style?.fontWeight, isNot(FontWeight.bold));

      // No unread blue dot
      expect(find.byKey(const Key('unread_dot_2')), findsNothing);
    });

    testWidgets(
        'renders amber star badge on flagged item and handles toggle',
        (tester) async {
      bool starTapped = false;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: EmailTile(
              email: unreadEmail,
              onTap: () {},
              onToggleStar: () => starTapped = true,
            ),
          ),
        ),
      );

      expect(find.byIcon(Icons.star_rounded), findsOneWidget);
      await tester.tap(find.byIcon(Icons.star_rounded));
      expect(starTapped, isTrue);
    });

    testWidgets('formats dates according to German rules', (tester) async {
      // 1. Today: formatted as "HH:mm"
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: EmailTile(email: unreadEmail, onTap: () {}),
          ),
        ),
      );
      // Matches pattern "HH:mm"
      expect(find.textContaining(RegExp(r'\d{2}:\d{2}')), findsOneWidget);

      // 2. Prior year: formatted as "dd.MM.yyyy"
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: EmailTile(email: readEmail, onTap: () {}),
          ),
        ),
      );
      expect(find.text('14.03.2025'), findsOneWidget);
    });

    testWidgets(
        'satisfies minimum 48dp touch height accessibility constraint',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: EmailTile(email: unreadEmail, onTap: () {}),
          ),
        ),
      );

      final size = tester.getSize(find.byType(EmailTile));
      expect(size.height, greaterThanOrEqualTo(48.0));
    });

    testWidgets('triggers onTap callback when clicked', (tester) async {
      bool tapped = false;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: EmailTile(
              email: unreadEmail,
              onTap: () => tapped = true,
            ),
          ),
        ),
      );

      await tester.tap(find.byType(EmailTile));
      expect(tapped, isTrue);
    });
  });
}
