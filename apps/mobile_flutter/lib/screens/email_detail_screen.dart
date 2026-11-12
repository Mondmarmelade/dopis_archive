import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../models/email_summary.dart';
import '../models/email_detail.dart';
import '../providers/mail_provider.dart';
import '../theme/app_theme.dart';
import '../utils/date_formatter.dart';
import '../widgets/sender_avatar.dart';
import '../widgets/ai_summary_card.dart';

/// Comprehensive email detail screen fulfilling Requirement R3.
class EmailDetailScreen extends StatefulWidget {
  final EmailSummary emailSummary;

  const EmailDetailScreen({
    super.key,
    required this.emailSummary,
  });

  @override
  State<EmailDetailScreen> createState() => _EmailDetailScreenState();
}

class _EmailDetailScreenState extends State<EmailDetailScreen> {
  bool _isLoadingDetail = false;
  bool _isAiLoading = false;
  String? _detailError;
  String? _aiError;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadDetailAndMarkRead();
    });
  }

  Future<void> _loadDetailAndMarkRead() async {
    final mailProvider = context.read<MailProvider>();
    final seq = widget.emailSummary.seq;

    // Automatically mark as read if currently unread
    if (widget.emailSummary.isUnread) {
      try {
        await mailProvider.markAsRead(seq);
      } catch (e) {
        debugPrint('Auto markAsRead error: $e');
      }
    }

    // Check if detail is already cached
    if (mailProvider.detailsCache.containsKey(seq)) {
      return;
    }

    setState(() {
      _isLoadingDetail = true;
      _detailError = null;
    });

    try {
      final detail = await mailProvider.fetchEmailDetail(seq);
      if (detail == null && mounted) {
        setState(() {
          _detailError = 'E-Mail-Details konnten nicht geladen werden.';
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _detailError = e.toString();
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoadingDetail = false;
        });
      }
    }
  }

  Future<void> _triggerAi(EmailDetail detail, {bool force = false}) async {
    final mailProvider = context.read<MailProvider>();

    setState(() {
      _isAiLoading = true;
      _aiError = null;
    });

    try {
      await mailProvider.triggerAiAnalysis(detail, force: force);
    } catch (e) {
      if (mounted) {
        setState(() {
          _aiError = e.toString().replaceAll('Exception: ', '');
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _isAiLoading = false;
        });
      }
    }
  }

  Future<void> _handleArchive(BuildContext context, MailProvider mailProvider) async {
    try {
      await mailProvider.archiveEmail(widget.emailSummary.seq);
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'E-Mail ins Archiv verschoben',
            style: GoogleFonts.poppins(fontSize: 13),
          ),
          backgroundColor: AppColors.primary,
          duration: const Duration(seconds: 2),
        ),
      );
      Navigator.of(context).pop();
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Fehler beim Archivieren: $e',
            style: GoogleFonts.poppins(fontSize: 13),
          ),
          backgroundColor: AppColors.errorText,
        ),
      );
    }
  }

  Future<void> _handleTrash(BuildContext context, MailProvider mailProvider) async {
    try {
      await mailProvider.trashEmail(widget.emailSummary.seq);
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'E-Mail in den Papierkorb verschoben',
            style: GoogleFonts.poppins(fontSize: 13),
          ),
          backgroundColor: AppColors.textPrimary,
          duration: const Duration(seconds: 2),
        ),
      );
      Navigator.of(context).pop();
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Fehler beim Löschen: $e',
            style: GoogleFonts.poppins(fontSize: 13),
          ),
          backgroundColor: AppColors.errorText,
        ),
      );
    }
  }

  /// Sanitizes HTML/plain text into clean readable string.
  String _sanitizeBodyText(String? html, String? text) {
    if (text != null && text.trim().isNotEmpty) {
      return text.trim();
    }
    if (html == null || html.trim().isEmpty) {
      return '(Kein Textinhalt)';
    }

    String cleaned = html;

    // 1. Strip script, style, iframe tags and their inner content
    cleaned = cleaned.replaceAll(
      RegExp(r'<(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\/\1>',
          caseSensitive: false),
      '',
    );

    // 2. Replace break and paragraph tags with newlines
    cleaned = cleaned.replaceAll(RegExp(r'<br\s*\/?>', caseSensitive: false), '\n');
    cleaned = cleaned.replaceAll(RegExp(r'<\/p>', caseSensitive: false), '\n\n');
    cleaned = cleaned.replaceAll(RegExp(r'<\/div>', caseSensitive: false), '\n');
    cleaned = cleaned.replaceAll(RegExp(r'<\/li>', caseSensitive: false), '\n');
    cleaned = cleaned.replaceAll(RegExp(r'<li[^>]*>', caseSensitive: false), '• ');

    // 3. Strip all remaining HTML tags
    cleaned = cleaned.replaceAll(RegExp(r'<[^>]+>'), '');

    // 4. Decode common HTML entities including German umlauts
    cleaned = cleaned
        .replaceAll('&nbsp;', ' ')
        .replaceAll('&amp;', '&')
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&quot;', '"')
        .replaceAll('&#39;', "'")
        .replaceAll('&auml;', 'ä')
        .replaceAll('&ouml;', 'ö')
        .replaceAll('&uuml;', 'ü')
        .replaceAll('&Auml;', 'Ä')
        .replaceAll('&Ouml;', 'Ö')
        .replaceAll('&Uuml;', 'Ü')
        .replaceAll('&szlig;', 'ß');

    // 5. Clean up redundant whitespace while preserving paragraph breaks
    cleaned = cleaned.replaceAll(RegExp(r'[ \t]+'), ' ');
    cleaned = cleaned.replaceAll(RegExp(r'\n{3,}'), '\n\n');

    return cleaned.trim();
  }

  @override
  Widget build(BuildContext context) {
    final mailProvider = context.watch<MailProvider>();
    final seq = widget.emailSummary.seq;

    // Retrieve active detail from cache if loaded
    final cachedDetail = mailProvider.detailsCache[seq];
    final aiAnalysis = mailProvider.aiCache[seq];

    // Determine current flags from cache or summary
    final isStarred = cachedDetail?.flagged ??
        mailProvider.emails
            .firstWhere((m) => m.seq == seq, orElse: () => widget.emailSummary)
            .isFlagged;
    final isRead = cachedDetail?.read ??
        mailProvider.emails
            .firstWhere((m) => m.seq == seq, orElse: () => widget.emailSummary)
            .read;

    final subject = cachedDetail?.subject ?? widget.emailSummary.subject;
    final senderName = cachedDetail?.name ?? widget.emailSummary.senderName;
    final senderEmail = cachedDetail?.email ?? widget.emailSummary.fromAddress;
    final emailDate = cachedDetail?.date ?? widget.emailSummary.date;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        scrolledUnderElevation: 1,
        titleSpacing: 0,
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1.0),
          child: Divider(height: 1, thickness: 1, color: AppColors.border),
        ),
        leading: TextButton.icon(
          style: TextButton.styleFrom(
            foregroundColor: AppColors.primary,
            padding: const EdgeInsets.symmetric(horizontal: 10),
            minimumSize: const Size(80, 48),
          ),
          icon: const Icon(Icons.arrow_back_rounded, size: 20),
          label: Text(
            'Zurück',
            style: GoogleFonts.poppins(
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
          onPressed: () => Navigator.of(context).pop(),
        ),
        leadingWidth: 100,
        actions: [
          // 1. Star / Unstar
          IconButton(
            tooltip: isStarred ? 'Stern entfernen' : 'Markieren',
            icon: Icon(
              isStarred ? Icons.star_rounded : Icons.star_outline_rounded,
              color: isStarred ? const Color(0xFFFBBF24) : AppColors.textMuted,
              size: 22,
            ),
            onPressed: () => mailProvider.toggleStar(seq),
          ),

          // 2. Mark Read / Unread
          IconButton(
            tooltip: isRead ? 'Als ungelesen markieren' : 'Als gelesen markieren',
            icon: Icon(
              isRead ? Icons.mail_outline_rounded : Icons.mark_email_read_rounded,
              color: AppColors.textMuted,
              size: 22,
            ),
            onPressed: () => mailProvider.toggleRead(seq),
          ),

          // 3. Archive
          IconButton(
            tooltip: 'Archivieren',
            icon: const Icon(
              Icons.archive_outlined,
              color: AppColors.textMuted,
              size: 22,
            ),
            onPressed: () => _handleArchive(context, mailProvider),
          ),

          // 4. Trash
          IconButton(
            tooltip: 'In den Papierkorb',
            icon: const Icon(
              Icons.delete_outline_rounded,
              color: AppColors.textMuted,
              size: 22,
            ),
            onPressed: () => _handleTrash(context, mailProvider),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 14.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 1. Subject Header
            Text(
              subject.isNotEmpty ? subject : '(Kein Betreff)',
              style: GoogleFonts.poppins(
                fontSize: 18.0,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
                height: 1.25,
              ),
            ),
            const SizedBox(height: 14.0),

            // 2. Sender Card
            Container(
              padding: const EdgeInsets.all(12.0),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(10.0),
                border: Border.all(color: AppColors.border),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.02),
                    blurRadius: 4.0,
                    offset: const Offset(0, 1),
                  ),
                ],
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SenderAvatar(
                    name: senderName,
                    email: senderEmail,
                    size: 40.0,
                    shape: BoxShape.circle,
                  ),
                  const SizedBox(width: 12.0),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          senderName.isNotEmpty ? senderName : senderEmail,
                          style: GoogleFonts.poppins(
                            fontSize: 14.0,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textPrimary,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        Text(
                          senderEmail,
                          style: GoogleFonts.poppins(
                            fontSize: 12.0,
                            color: AppColors.textMuted,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (cachedDetail != null && cachedDetail.to.isNotEmpty) ...[
                          const SizedBox(height: 2.0),
                          Text(
                            'An: ${cachedDetail.to.map((r) => r.name.isNotEmpty ? r.name : r.address).join(', ')}',
                            style: GoogleFonts.poppins(
                              fontSize: 11.0,
                              color: AppColors.textMuted,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(width: 8.0),
                  Text(
                    GermanDateFormatter.format(emailDate),
                    style: GoogleFonts.poppins(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w500,
                      color: AppColors.textMuted,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12.0),

            // 3. Attachments Card (if any)
            if (cachedDetail != null && cachedDetail.hasAttachments) ...[
              Container(
                margin: const EdgeInsets.only(bottom: 12.0),
                padding: const EdgeInsets.all(12.0),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(10.0),
                  border: Border.all(color: AppColors.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(
                          Icons.attach_file_rounded,
                          size: 16.0,
                          color: AppColors.primary,
                        ),
                        const SizedBox(width: 6.0),
                        Text(
                          'Anhänge (${cachedDetail.attachments.length})',
                          style: GoogleFonts.poppins(
                            fontSize: 12.0,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8.0),
                    Wrap(
                      spacing: 8.0,
                      runSpacing: 6.0,
                      children: cachedDetail.attachments.map((att) {
                        return Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10.0,
                            vertical: 6.0,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.background,
                            borderRadius: BorderRadius.circular(6.0),
                            border: Border.all(color: AppColors.border),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(
                                Icons.insert_drive_file_outlined,
                                size: 14.0,
                                color: AppColors.textMuted,
                              ),
                              const SizedBox(width: 6.0),
                              ConstrainedBox(
                                constraints: const BoxConstraints(maxWidth: 160),
                                child: Text(
                                  att.filename,
                                  style: GoogleFonts.poppins(
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.w500,
                                    color: AppColors.textPrimary,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              const SizedBox(width: 6.0),
                              Text(
                                att.formattedSize,
                                style: GoogleFonts.poppins(
                                  fontSize: 10.5,
                                  color: AppColors.textMuted,
                                ),
                              ),
                            ],
                          ),
                        );
                      }).toList(),
                    ),
                  ],
                ),
              ),
            ],

            // 4. Dopis AI Summary Card
            AiSummaryCard(
              analysis: aiAnalysis,
              isLoading: _isAiLoading,
              errorMessage: _aiError,
              onTriggerAnalysis: () {
                if (cachedDetail != null) {
                  _triggerAi(cachedDetail);
                } else {
                  // If detail not loaded yet, create fallback from summary
                  final fallback = EmailDetail(
                    id: widget.emailSummary.id,
                    seq: widget.emailSummary.seq,
                    uid: widget.emailSummary.uid,
                    subject: widget.emailSummary.subject,
                    from: EmailRecipient(
                      name: widget.emailSummary.name,
                      address: widget.emailSummary.email,
                    ),
                    to: const [],
                    cc: const [],
                    date: widget.emailSummary.date,
                    text: widget.emailSummary.snippet,
                    read: widget.emailSummary.read,
                    flagged: widget.emailSummary.flagged,
                  );
                  _triggerAi(fallback);
                }
              },
              onReanalyze: () {
                if (cachedDetail != null) {
                  _triggerAi(cachedDetail, force: true);
                }
              },
              onToggleActionItem: (index) {
                mailProvider.toggleActionItem(seq, index);
              },
            ),
            const SizedBox(height: 12.0),

            // 5. Email Body Reader
            if (_isLoadingDetail) ...[
              const Center(
                child: Padding(
                  padding: EdgeInsets.symmetric(vertical: 36.0),
                  child: Column(
                    children: [
                      SizedBox(
                        width: 24,
                        height: 24,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.2,
                          valueColor: AlwaysStoppedAnimation<Color>(AppColors.primary),
                        ),
                      ),
                      SizedBox(height: 12),
                      Text('E-Mail-Inhalt wird geladen...'),
                    ],
                  ),
                ),
              ),
            ] else if (_detailError != null) ...[
              Container(
                padding: const EdgeInsets.all(16.0),
                decoration: BoxDecoration(
                  color: AppColors.errorBackground,
                  borderRadius: BorderRadius.circular(8.0),
                  border: Border.all(color: AppColors.errorBorder),
                ),
                child: Column(
                  children: [
                    Text(
                      _detailError!,
                      style: GoogleFonts.poppins(
                        fontSize: 13,
                        color: AppColors.errorText,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 10),
                    OutlinedButton(
                      onPressed: _loadDetailAndMarkRead,
                      child: const Text('Erneut versuchen'),
                    ),
                  ],
                ),
              ),
            ] else ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16.0),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(10.0),
                  border: Border.all(color: AppColors.border),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.02),
                      blurRadius: 4.0,
                      offset: const Offset(0, 1),
                    ),
                  ],
                ),
                child: SelectableText(
                  _sanitizeBodyText(
                    cachedDetail?.html,
                    cachedDetail?.text ?? widget.emailSummary.snippet,
                  ),
                  style: GoogleFonts.poppins(
                    fontSize: 14.5,
                    height: 1.55,
                    color: const Color(0xFF1E293B),
                  ),
                ),
              ),
            ],
            const SizedBox(height: 24.0),
          ],
        ),
      ),
    );
  }
}
