import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:dopis_mobile/widgets/sender_avatar.dart';

void main() {
  setUp(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  group('SenderAvatar Widget Tests', () {
    testWidgets('computes initials correctly across all naming formats',
        (tester) async {
      // 1. Two-word name
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: SenderAvatar(name: 'Max Mustermann', email: 'max@test.de'),
          ),
        ),
      );
      expect(find.text('MM'), findsOneWidget);

      // 2. Single word name
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: SenderAvatar(name: 'Amazon', email: 'auto@amazon.de'),
          ),
        ),
      );
      expect(find.text('A'), findsOneWidget);

      // 3. Multi-word name with titles
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: SenderAvatar(name: 'Dr. Jane Doe', email: 'jane@clinic.de'),
          ),
        ),
      );
      expect(find.text('DJ'), findsOneWidget);

      // 4. Missing name -> fallback to email prefix
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: SenderAvatar(name: '', email: 'service@github.com'),
          ),
        ),
      );
      expect(find.text('SE'), findsOneWidget);

      // 5. Empty name and email -> fallback to "?"
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: SenderAvatar(name: '', email: ''),
          ),
        ),
      );
      expect(find.text('?'), findsOneWidget);

      // 6. German umlaut support
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: SenderAvatar(name: 'Österreich Post', email: 'info@post.at'),
          ),
        ),
      );
      expect(find.text('ÖP'), findsOneWidget);
    });

    testWidgets('generates consistent color from 11-color palette',
        (tester) async {
      const colors = [
        Color(0xFF2563EB),
        Color(0xFF78350F),
        Color(0xFF0F766E),
        Color(0xFF1D4ED8),
        Color(0xFF7C3AED),
        Color(0xFFB91C1C),
        Color(0xFFC2410C),
        Color(0xFF047857),
        Color(0xFF4338CA),
        Color(0xFFA21CAF),
        Color(0xFF0369A1),
      ];

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: SenderAvatar(name: 'Vinted', email: 'no-reply@vinted.de'),
          ),
        ),
      );

      final container = tester.widget<Container>(
        find
            .descendant(
              of: find.byType(SenderAvatar),
              matching: find.byType(Container),
            )
            .first,
      );

      final decoration = container.decoration as BoxDecoration;
      expect(colors.contains(decoration.color), isTrue);
    });

    testWidgets('respects custom size parameters', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: SenderAvatar(
              name: 'John Doe',
              email: 'john@example.com',
              size: 44.0,
            ),
          ),
        ),
      );

      final container = tester.widget<Container>(
        find
            .descendant(
              of: find.byType(SenderAvatar),
              matching: find.byType(Container),
            )
            .first,
      );

      expect(container.constraints?.minWidth, 44.0);
      expect(container.constraints?.minHeight, 44.0);
    });
  });
}
