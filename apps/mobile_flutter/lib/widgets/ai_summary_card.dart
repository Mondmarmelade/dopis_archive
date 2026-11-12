import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/ai_analysis.dart';
import '../theme/app_theme.dart';

/// Category color helper matching apps/web/src/components/mail/AiInsightsCard.jsx
class AiCategoryStyle {
  final Color background;
  final Color text;
  final Color border;

  const AiCategoryStyle({
    required this.background,
    required this.text,
    required this.border,
  });

  static AiCategoryStyle forCategory(String? category) {
    switch (category?.toLowerCase()) {
      case 'spam':
      case 'phishing':
        return const AiCategoryStyle(
          background: Color(0xFFFFF1F2),
          text: Color(0xFFBE123C),
          border: Color(0xFFFECDD3),
        );
      case 'werbung':
      case 'angebote':
        return const AiCategoryStyle(
          background: Color(0xFFFFFBEB),
          text: Color(0xFFB45309),
          border: Color(0xFFFDE68A),
        );
      case 'rechnung':
      case 'finanzen':
        return const AiCategoryStyle(
          background: Color(0xFFECFDF5),
          text: Color(0xFF047857),
          border: Color(0xFFA7F3D0),
        );
      case 'dringend':
      case 'wichtig':
        return const AiCategoryStyle(
          background: Color(0xFFFEF2F2),
          text: Color(0xFFB91C1C),
          border: Color(0xFFFECACA),
        );
      case 'newsletter':
        return const AiCategoryStyle(
          background: Color(0xFFFAF5FF),
          text: Color(0xFF7E22CE),
          border: Color(0xFFE9D5FF),
        );
      case 'benachrichtigung':
        return const AiCategoryStyle(
          background: Color(0xFFEFF6FF),
          text: Color(0xFF1D4ED8),
          border: Color(0xFFBFDBFE),
        );
      case 'persönlich':
        return const AiCategoryStyle(
          background: Color(0xFFEEF2FF),
          text: Color(0xFF4338CA),
          border: Color(0xFFC7D2FE),
        );
      case 'update':
        return const AiCategoryStyle(
          background: Color(0xFFF0FDFA),
          text: Color(0xFF0F766E),
          border: Color(0xFF99F6E4),
        );
      default:
        return const AiCategoryStyle(
          background: Color(0xFFF1F5F9),
          text: Color(0xFF475569),
          border: Color(0xFFE2E8F0),
        );
    }
  }
}

/// Dopis AI Summary Card replicating web AiInsightsCard.jsx.
class AiSummaryCard extends StatefulWidget {
  final AiAnalysisResult? analysis;
  final bool isLoading;
  final String? errorMessage;
  final VoidCallback onTriggerAnalysis;
  final VoidCallback? onReanalyze;
  final void Function(int taskIndex)? onToggleActionItem;

  const AiSummaryCard({
    super.key,
    this.analysis,
    this.isLoading = false,
    this.errorMessage,
    required this.onTriggerAnalysis,
    this.onReanalyze,
    this.onToggleActionItem,
  });

  @override
  State<AiSummaryCard> createState() => _AiSummaryCardState();
}

class _AiSummaryCardState extends State<AiSummaryCard> {
  bool _isCollapsed = false;

  @override
  Widget build(BuildContext context) {
    // 1. Loading State
    if (widget.isLoading) {
      return Container(
        margin: const EdgeInsets.symmetric(vertical: 8.0),
        padding: const EdgeInsets.all(14.0),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(10.0),
          border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
          boxShadow: [
            BoxShadow(
              color: AppColors.primary.withValues(alpha: 0.05),
              blurRadius: 6.0,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            const SizedBox(
              width: 18.0,
              height: 18.0,
              child: CircularProgressIndicator(
                strokeWidth: 2.2,
                valueColor: AlwaysStoppedAnimation<Color>(AppColors.primary),
              ),
            ),
            const SizedBox(width: 12.0),
            Expanded(
              child: Text(
                'KI analysiert E-Mail (Zusammenfassung, Kategorie & To-Dos)...',
                style: GoogleFonts.poppins(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w500,
                  color: AppColors.primary,
                ),
              ),
            ),
          ],
        ),
      );
    }

    // 2. Error State
    if (widget.errorMessage != null) {
      return Container(
        margin: const EdgeInsets.symmetric(vertical: 8.0),
        padding: const EdgeInsets.all(12.0),
        decoration: BoxDecoration(
          color: AppColors.errorBackground,
          borderRadius: BorderRadius.circular(10.0),
          border: Border.all(color: AppColors.errorBorder),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(
                  Icons.error_outline_rounded,
                  size: 18.0,
                  color: AppColors.errorText,
                ),
                const SizedBox(width: 8.0),
                Expanded(
                  child: Text(
                    'KI-Analyse fehlgeschlagen: ${widget.errorMessage}',
                    style: GoogleFonts.poppins(
                      fontSize: 12.0,
                      fontWeight: FontWeight.w500,
                      color: AppColors.errorText,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8.0),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: widget.onReanalyze ?? widget.onTriggerAnalysis,
                icon: const Icon(Icons.refresh_rounded, size: 16.0),
                label: Text(
                  'Erneut versuchen',
                  style: GoogleFonts.poppins(
                    fontSize: 12.0,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                style: TextButton.styleFrom(
                  foregroundColor: AppColors.errorText,
                  minimumSize: const Size(48, 36),
                  padding: const EdgeInsets.symmetric(horizontal: 10.0),
                ),
              ),
            ),
          ],
        ),
      );
    }

    // 3. Unanalyzed State: Trigger Button
    if (widget.analysis == null) {
      return Container(
        margin: const EdgeInsets.symmetric(vertical: 8.0),
        padding: const EdgeInsets.all(14.0),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(10.0),
          border: Border.all(color: AppColors.border),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.03),
              blurRadius: 4.0,
              offset: const Offset(0, 1),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 34.0,
              height: 34.0,
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8.0),
              ),
              child: const Icon(
                Icons.auto_awesome_rounded,
                size: 18.0,
                color: AppColors.primary,
              ),
            ),
            const SizedBox(width: 12.0),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '✦ KI-Zusammenfassung',
                    style: GoogleFonts.poppins(
                      fontSize: 13.0,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  Text(
                    'Kompakte Zusammenfassung & Aufgaben extrahieren',
                    style: GoogleFonts.poppins(
                      fontSize: 11.0,
                      color: AppColors.textMuted,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8.0),
            ElevatedButton.icon(
              onPressed: widget.onTriggerAnalysis,
              icon: const Icon(Icons.auto_awesome, size: 14.0),
              label: Text(
                'Analysieren',
                style: GoogleFonts.poppins(
                  fontSize: 12.0,
                  fontWeight: FontWeight.w600,
                ),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                elevation: 0,
                minimumSize: const Size(90, 42),
                padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 8.0),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8.0),
                ),
              ),
            ),
          ],
        ),
      );
    }

    // 4. Analyzed State
    final analysis = widget.analysis!;
    final categoryStyle = AiCategoryStyle.forCategory(analysis.category);
    final hasActionItems = analysis.actionItems.isNotEmpty;

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 8.0),
      padding: const EdgeInsets.all(14.0),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10.0),
        border: Border.all(color: AppColors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 4.0,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Row: Title, Category Badge, Actions (Reanalyze, Collapse)
          Row(
            children: [
              const Icon(
                Icons.auto_awesome_rounded,
                size: 16.0,
                color: AppColors.primary,
              ),
              const SizedBox(width: 6.0),
              Text(
                '✦ KI-Zusammenfassung',
                style: GoogleFonts.poppins(
                  fontSize: 13.0,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(width: 8.0),

              // Category Badge
              if (analysis.category.isNotEmpty) ...[
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6.0, vertical: 2.0),
                  decoration: BoxDecoration(
                    color: categoryStyle.background,
                    borderRadius: BorderRadius.circular(4.0),
                    border: Border.all(color: categoryStyle.border),
                  ),
                  child: Text(
                    analysis.category,
                    style: GoogleFonts.poppins(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w600,
                      color: categoryStyle.text,
                    ),
                  ),
                ),
              ],

              const Spacer(),

              // Reanalyze Button
              if (widget.onReanalyze != null)
                IconButton(
                  tooltip: 'Neu analysieren',
                  icon: const Icon(Icons.refresh_rounded, size: 16.0, color: AppColors.textMuted),
                  onPressed: widget.onReanalyze,
                  constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                  padding: EdgeInsets.zero,
                ),

              // Collapse / Expand Toggle
              IconButton(
                tooltip: _isCollapsed ? 'Details ausklappen' : 'Details einklappen',
                icon: Icon(
                  _isCollapsed ? Icons.keyboard_arrow_down_rounded : Icons.keyboard_arrow_up_rounded,
                  size: 20.0,
                  color: AppColors.textMuted,
                ),
                onPressed: () {
                  setState(() {
                    _isCollapsed = !_isCollapsed;
                  });
                },
                constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                padding: EdgeInsets.zero,
              ),
            ],
          ),

          // Tag Chips (if any)
          if (analysis.tags.isNotEmpty) ...[
            const SizedBox(height: 6.0),
            Wrap(
              spacing: 6.0,
              runSpacing: 4.0,
              children: analysis.tags.map((tag) {
                return Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6.0, vertical: 1.5),
                  decoration: BoxDecoration(
                    color: AppColors.background,
                    borderRadius: BorderRadius.circular(4.0),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.tag_rounded, size: 10.0, color: AppColors.textMuted),
                      const SizedBox(width: 3.0),
                      Text(
                        tag,
                        style: GoogleFonts.poppins(
                          fontSize: 10.0,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
          ],

          // Collapsible Body
          if (!_isCollapsed) ...[
            const SizedBox(height: 10.0),
            const Divider(height: 1, thickness: 1, color: AppColors.border),
            const SizedBox(height: 10.0),

            // Bulleted Summary
            if (analysis.summary.isNotEmpty) ...[
              Text(
                'Zusammenfassung',
                style: GoogleFonts.poppins(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 4.0),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: analysis.summary.map((point) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 4.0),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          margin: const EdgeInsets.only(top: 6.0, right: 8.0),
                          width: 4.0,
                          height: 4.0,
                          decoration: const BoxDecoration(
                            color: AppColors.primary,
                            shape: BoxShape.circle,
                          ),
                        ),
                        Expanded(
                          child: Text(
                            point,
                            style: GoogleFonts.poppins(
                              fontSize: 12.5,
                              height: 1.4,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              ),
            ],

            // Action Items
            if (hasActionItems) ...[
              const SizedBox(height: 8.0),
              const Divider(height: 1, thickness: 1, color: AppColors.border),
              const SizedBox(height: 8.0),
              Row(
                children: [
                  const Icon(
                    Icons.check_circle_outline_rounded,
                    size: 14.0,
                    color: Color(0xFF047857),
                  ),
                  const SizedBox(width: 6.0),
                  Text(
                    'Aufgaben & Handlungsbedarf',
                    style: GoogleFonts.poppins(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6.0),
              Column(
                children: List.generate(analysis.actionItems.length, (idx) {
                  final action = analysis.actionItems[idx];
                  return Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: widget.onToggleActionItem != null
                          ? () => widget.onToggleActionItem!(idx)
                          : null,
                      borderRadius: BorderRadius.circular(6.0),
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 4.0),
                        padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 6.0),
                        decoration: BoxDecoration(
                          color: action.completed
                              ? AppColors.background
                              : const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(6.0),
                          border: Border.all(
                            color: action.completed
                                ? Colors.transparent
                                : AppColors.border,
                          ),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Padding(
                              padding: const EdgeInsets.only(top: 2.0, right: 8.0),
                              child: Icon(
                                action.completed
                                    ? Icons.check_circle_rounded
                                    : Icons.radio_button_unchecked_rounded,
                                size: 16.0,
                                color: action.completed
                                    ? const Color(0xFF047857)
                                    : AppColors.textMuted,
                              ),
                            ),
                            Expanded(
                              child: Text(
                                action.task,
                                style: GoogleFonts.poppins(
                                  fontSize: 12.0,
                                  fontWeight: action.completed
                                      ? FontWeight.w400
                                      : FontWeight.w500,
                                  color: action.completed
                                      ? AppColors.textMuted
                                      : AppColors.textPrimary,
                                  decoration: action.completed
                                      ? TextDecoration.lineThrough
                                      : null,
                                ),
                              ),
                            ),
                            if (action.due != null && action.due!.isNotEmpty) ...[
                              const SizedBox(width: 6.0),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 5.0,
                                  vertical: 1.0,
                                ),
                                decoration: BoxDecoration(
                                  color: AppColors.background,
                                  borderRadius: BorderRadius.circular(4.0),
                                  border: Border.all(color: AppColors.border),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    const Icon(
                                      Icons.access_time_rounded,
                                      size: 10.0,
                                      color: AppColors.textMuted,
                                    ),
                                    const SizedBox(width: 3.0),
                                    Text(
                                      action.due!,
                                      style: GoogleFonts.poppins(
                                        fontSize: 10.0,
                                        color: AppColors.textMuted,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                  );
                }),
              ),
            ],
          ],
        ],
      ),
    );
  }
}
