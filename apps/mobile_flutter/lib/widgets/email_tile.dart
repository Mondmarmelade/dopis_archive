import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/email_summary.dart';
import '../utils/date_formatter.dart';
import 'sender_avatar.dart';

class EmailTile extends StatelessWidget {
  final EmailSummary email;
  final VoidCallback onTap;
  final VoidCallback? onToggleStar;

  const EmailTile({
    super.key,
    required this.email,
    required this.onTap,
    this.onToggleStar,
  });

  @override
  Widget build(BuildContext context) {
    final isUnread = email.isUnread;
    final isStarred = email.isFlagged;

    const primaryBlue = Color(0xFF3661A4);
    const unreadTint = Color(0xFFF1F7FF);
    const unreadDotColor = Color(0xFF2563EB);
    const cardBorderColor = Color(0xFFE2E8F0);
    const textPrimaryColor = Color(0xFF0F172A);
    const textSecondaryColor = Color(0xFF334155);
    const textMutedColor = Color(0xFF64748B);
    const amberStarColor = Color(0xFFFBBF24);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8.0),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          constraints: const BoxConstraints(minHeight: 74.0),
          padding: const EdgeInsets.symmetric(horizontal: 14.0, vertical: 12.0),
          decoration: BoxDecoration(
            color: isUnread ? unreadTint : Colors.white,
            borderRadius: BorderRadius.circular(8.0),
            border: Border.all(
              color: isUnread
                  ? primaryBlue.withValues(alpha: 0.35)
                  : cardBorderColor,
              width: isUnread ? 1.5 : 1.0,
            ),
            boxShadow: isUnread
                ? [
                    BoxShadow(
                      color: primaryBlue.withValues(alpha: 0.06),
                      blurRadius: 4.0,
                      offset: const Offset(0, 1),
                    ),
                  ]
                : null,
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. Sender Avatar
              SenderAvatar(
                name: email.name,
                email: email.email,
                size: 38.0,
                shape: BoxShape.circle,
              ),
              const SizedBox(width: 12.0),

              // 2. Email Body Column
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Row 1: Unread Dot + Sender Name + Date
                    Row(
                      children: [
                        if (isUnread) ...[
                          Container(
                            key: Key('unread_dot_${email.id}'),
                            width: 8.0,
                            height: 8.0,
                            decoration: const BoxDecoration(
                              color: unreadDotColor,
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 6.0),
                        ],
                        Expanded(
                          child: Text(
                            email.name.isNotEmpty ? email.name : email.email,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: GoogleFonts.poppins(
                              fontSize: 13.5,
                              fontWeight:
                                  isUnread ? FontWeight.bold : FontWeight.w500,
                              color: isUnread
                                  ? textPrimaryColor
                                  : textSecondaryColor,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8.0),
                        Text(
                          GermanDateFormatter.format(email.date),
                          style: GoogleFonts.poppins(
                            fontSize: 11.0,
                            fontWeight:
                                isUnread ? FontWeight.w600 : FontWeight.w400,
                            color: isUnread ? primaryBlue : textMutedColor,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 3.0),

                    // Row 2: Subject + Star Button
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            email.subject.isNotEmpty
                                ? email.subject
                                : '(Kein Betreff)',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: GoogleFonts.poppins(
                              fontSize: 13.0,
                              fontWeight:
                                  isUnread ? FontWeight.bold : FontWeight.w400,
                              color: isUnread
                                  ? textPrimaryColor
                                  : textSecondaryColor,
                            ),
                          ),
                        ),
                        if (onToggleStar != null) ...[
                          const SizedBox(width: 4.0),
                          GestureDetector(
                            onTap: onToggleStar,
                            behavior: HitTestBehavior.opaque,
                            child: Padding(
                              padding: const EdgeInsets.all(4.0),
                              child: Icon(
                                isStarred
                                    ? Icons.star_rounded
                                    : Icons.star_outline_rounded,
                                size: 18.0,
                                color: isStarred
                                    ? amberStarColor
                                    : const Color(0xFFCBD5E1),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),

                    // Row 3: Snippet Preview (if available)
                    if (email.snippet != null &&
                        email.snippet!.trim().isNotEmpty) ...[
                      const SizedBox(height: 3.0),
                      Text(
                        email.snippet!.trim(),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: GoogleFonts.poppins(
                          fontSize: 12.0,
                          fontWeight: FontWeight.w400,
                          color: textMutedColor,
                          height: 1.3,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
