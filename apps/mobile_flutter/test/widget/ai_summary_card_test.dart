import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:dopis_mobile/models/ai_analysis.dart';
import 'package:dopis_mobile/widgets/ai_summary_card.dart';

void main() {
  setUp(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  group('AiSummaryCard Widget Tests', () {
    testWidgets('renders unanalyzed state with trigger button and text',
        (tester) async {
      bool triggered = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: AiSummaryCard(
              analysis: null,
              isLoading: false,
              errorMessage: null,
              onTriggerAnalysis: () => triggered = true,
            ),
          ),
        ),
      );

      expect(find.text('✦ KI-Zusammenfassung'), findsOneWidget);
      expect(find.text('Analysieren'), findsOneWidget);
      expect(
          find.text('Kompakte Zusammenfassung & Aufgaben extrahieren'),
          findsOneWidget);

      await tester.tap(find.text('Analysieren'));
      expect(triggered, isTrue);
    });

    testWidgets('renders loading state with spinner and message',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: AiSummaryCard(
              analysis: null,
              isLoading: true,
              errorMessage: null,
              onTriggerAnalysis: () {},
            ),
          ),
        ),
      );

      expect(
        find.text(
            'KI analysiert E-Mail (Zusammenfassung, Kategorie & To-Dos)...'),
        findsOneWidget,
      );
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('renders error state with retry button and triggers callback',
        (tester) async {
      bool reanalyzed = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: AiSummaryCard(
              analysis: null,
              isLoading: false,
              errorMessage: 'Verbindung zum KI-Modell fehlgeschlagen',
              onTriggerAnalysis: () {},
              onReanalyze: () => reanalyzed = true,
            ),
          ),
        ),
      );

      expect(
        find.text(
            'KI-Analyse fehlgeschlagen: Verbindung zum KI-Modell fehlgeschlagen'),
        findsOneWidget,
      );
      expect(find.text('Erneut versuchen'), findsOneWidget);

      await tester.tap(find.text('Erneut versuchen'));
      expect(reanalyzed, isTrue);
    });

    testWidgets('renders full analysis with category, tags, summary and actions',
        (tester) async {
      int? toggledIndex;
      final analysis = AiAnalysisResult(
        category: 'Rechnung',
        tags: const ['Finanzen', 'September'],
        summary: const [
          'Rechnung über 149,00 € erhalten.',
          'Fällig bis zum 15. September 2026.',
        ],
        actionItems: const [
          ActionItem(
            task: 'Betrag überweisen',
            due: '15.09.2026',
            completed: false,
          ),
          ActionItem(
            task: 'Rechnung an Buchhaltung weiterleiten',
            completed: true,
          ),
        ],
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: AiSummaryCard(
                analysis: analysis,
                isLoading: false,
                errorMessage: null,
                onTriggerAnalysis: () {},
                onToggleActionItem: (idx) => toggledIndex = idx,
              ),
            ),
          ),
        ),
      );

      // Header & category
      expect(find.text('✦ KI-Zusammenfassung'), findsOneWidget);
      expect(find.text('Rechnung'), findsOneWidget);

      // Tags
      expect(find.text('Finanzen'), findsOneWidget);
      expect(find.text('September'), findsOneWidget);

      // Summary
      expect(find.text('Zusammenfassung'), findsOneWidget);
      expect(find.text('Rechnung über 149,00 € erhalten.'), findsOneWidget);
      expect(find.text('Fällig bis zum 15. September 2026.'), findsOneWidget);

      // Action Items
      expect(find.text('Aufgaben & Handlungsbedarf'), findsOneWidget);
      expect(find.text('Betrag überweisen'), findsOneWidget);
      expect(find.text('15.09.2026'), findsOneWidget);
      expect(
          find.text('Rechnung an Buchhaltung weiterleiten'), findsOneWidget);

      // Check icons
      expect(find.byIcon(Icons.radio_button_unchecked_rounded), findsOneWidget);
      expect(find.byIcon(Icons.check_circle_rounded), findsOneWidget);

      // Tap action item
      await tester.tap(find.text('Betrag überweisen'));
      expect(toggledIndex, 0);
    });

    testWidgets('collapse and expand toggles visibility of body content',
        (tester) async {
      final analysis = AiAnalysisResult(
        category: 'Wichtig',
        summary: const ['Dringendes Projektmeeting heute.'],
        actionItems: const [],
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: AiSummaryCard(
                analysis: analysis,
                onTriggerAnalysis: () {},
              ),
            ),
          ),
        ),
      );

      expect(find.text('Dringendes Projektmeeting heute.'), findsOneWidget);

      // Tap collapse button
      await tester.tap(find.byTooltip('Details einklappen'));
      await tester.pumpAndSettle();

      // Content hidden
      expect(find.text('Dringendes Projektmeeting heute.'), findsNothing);
      expect(find.byTooltip('Details ausklappen'), findsOneWidget);

      // Tap expand button
      await tester.tap(find.byTooltip('Details ausklappen'));
      await tester.pumpAndSettle();

      // Content visible again
      expect(find.text('Dringendes Projektmeeting heute.'), findsOneWidget);
    });
  });
}
