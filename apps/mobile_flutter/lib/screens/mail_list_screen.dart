import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/mail_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/folder_pills.dart';
import '../widgets/email_tile.dart';

/// Mailbox stream screen replicating web AccountSwitcher and MailList.
class MailListScreen extends StatefulWidget {
  const MailListScreen({super.key});

  @override
  State<MailListScreen> createState() => _MailListScreenState();
}

class _MailListScreenState extends State<MailListScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final mailProvider = context.read<MailProvider>();
      if (mailProvider.emails.isEmpty && !mailProvider.isLoading) {
        mailProvider.fetchEmails();
      }
    });
  }

  Future<void> _showLogoutDialog(BuildContext context, AuthProvider auth) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10.0)),
        title: Text(
          'Abmelden',
          style: GoogleFonts.poppins(fontWeight: FontWeight.w600, fontSize: 18),
        ),
        content: Text(
          'Möchtest du dich wirklich von deinem Postfach abmelden?',
          style: GoogleFonts.poppins(fontSize: 14, color: AppColors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(
              'Abbrechen',
              style: GoogleFonts.poppins(color: AppColors.textSecondary),
            ),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.errorText,
              foregroundColor: Colors.white,
              minimumSize: const Size(96, 40),
            ),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(
              'Abmelden',
              style: GoogleFonts.poppins(fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      await auth.logout();
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final mailProvider = context.watch<MailProvider>();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(56.0),
        child: Container(
          decoration: const BoxDecoration(
            color: AppColors.surface,
            border: Border(bottom: BorderSide(color: AppColors.border, width: 1.0)),
          ),
          child: SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12.0),
              child: Row(
                children: [
                  // 1. "D" Badge Avatar (32x32dp, #3661A4, bold white text)
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(8.0),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      'D',
                      style: GoogleFonts.poppins(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 15.0,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),

                  // 2. Title "Dopis" and Subtitle (active email with ellipsis)
                  Expanded(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Dopis',
                          style: GoogleFonts.poppins(
                            fontSize: 15.0,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textPrimary,
                            height: 1.1,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        Text(
                          auth.userEmail?.isNotEmpty == true
                              ? auth.userEmail!
                              : 'IMAP Mailbox',
                          style: GoogleFonts.poppins(
                            fontSize: 11.0,
                            fontWeight: FontWeight.w400,
                            color: AppColors.textMuted,
                            height: 1.2,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),

                  // 3. Refresh Action Button with Animated Spin
                  _AnimatedRefreshButton(
                    isRefreshing: mailProvider.isLoading || mailProvider.isRefreshing,
                    onPressed: () => mailProvider.fetchEmails(refresh: true),
                  ),

                  // 4. Sign-Out Action Button ("Abmelden")
                  IconButton(
                    icon: const Icon(Icons.logout_rounded, size: 20, color: AppColors.textMuted),
                    tooltip: 'Abmelden',
                    onPressed: () => _showLogoutDialog(context, auth),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
      body: Column(
        children: [
          // Sticky Folder Navigation Pills Row
          Container(
            color: AppColors.surface,
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 8.0),
            child: FolderPills(
              selectedFolder: mailProvider.currentFolder,
              unreadCount: mailProvider.unreadCount,
              folderUnreadCounts: mailProvider.folderUnreadCounts,
              onSelectFolder: (folder) => mailProvider.selectFolder(folder),
            ),
          ),
          const Divider(height: 1, thickness: 1, color: AppColors.border),

          // Scrollable Mail List or State View
          Expanded(
            child: _buildBodyContent(context, mailProvider),
          ),
        ],
      ),
    );
  }

  Widget _buildBodyContent(BuildContext context, MailProvider mailProvider) {
    // 1. Initial Loading State (when no cached emails yet)
    if (mailProvider.isLoading && mailProvider.emails.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(
              width: 26,
              height: 26,
              child: CircularProgressIndicator(
                strokeWidth: 2.4,
                valueColor: AlwaysStoppedAnimation<Color>(AppColors.primary),
              ),
            ),
            const SizedBox(height: 14),
            Text(
              '${mailProvider.currentFolderDisplayName} wird synchronisiert...',
              style: GoogleFonts.poppins(
                fontSize: 13.0,
                color: AppColors.textMuted,
              ),
            ),
          ],
        ),
      );
    }

    // 2. Error State
    if (mailProvider.errorMessage != null && mailProvider.emails.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.error_outline_rounded,
                size: 48,
                color: AppColors.errorBorder,
              ),
              const SizedBox(height: 12),
              Text(
                'E-Mails konnten nicht geladen werden',
                textAlign: TextAlign.center,
                style: GoogleFonts.poppins(
                  fontSize: 15.0,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                mailProvider.errorMessage!,
                textAlign: TextAlign.center,
                style: GoogleFonts.poppins(
                  fontSize: 12.0,
                  color: AppColors.textMuted,
                ),
              ),
              const SizedBox(height: 18),
              OutlinedButton.icon(
                icon: const Icon(Icons.refresh, size: 16),
                label: const Text('Erneut versuchen'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.primary,
                  side: const BorderSide(color: AppColors.border),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(6.0),
                  ),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                ),
                onPressed: () => mailProvider.fetchEmails(refresh: true),
              ),
            ],
          ),
        ),
      );
    }

    // 3. Empty State (matching MailList.jsx)
    if (mailProvider.emails.isEmpty) {
      return RefreshIndicator(
        onRefresh: () => mailProvider.fetchEmails(refresh: true),
        color: AppColors.primary,
        backgroundColor: AppColors.surface,
        child: LayoutBuilder(
          builder: (context, constraints) => SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: constraints.maxHeight),
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(24.0),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.inbox_outlined,
                        size: 48,
                        color: AppColors.textSubtle,
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'Keine E-Mails gefunden',
                        textAlign: TextAlign.center,
                        style: GoogleFonts.poppins(
                          fontSize: 15.0,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Dein Postfach oder Suchfilter enthält derzeit keine Ergebnisse.',
                        textAlign: TextAlign.center,
                        style: GoogleFonts.poppins(
                          fontSize: 12.0,
                          color: AppColors.textMuted,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      );
    }

    // 4. Populated Mail Stream
    return RefreshIndicator(
      onRefresh: () => mailProvider.fetchEmails(refresh: true),
      color: AppColors.primary,
      backgroundColor: AppColors.surface,
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        itemCount: mailProvider.emails.length,
        separatorBuilder: (_, __) => const Divider(
          height: 1,
          thickness: 1,
          color: AppColors.border,
        ),
        itemBuilder: (context, index) {
          final email = mailProvider.emails[index];
          return EmailTile(
            email: email,
            onTap: () {
              Navigator.of(context).pushNamed(
                '/email-detail',
                arguments: email,
              );
            },
            onToggleStar: () => mailProvider.toggleStar(email.seq),
          );
        },
      ),
    );
  }
}

/// Custom animated refresh button rotating when refreshing.
class _AnimatedRefreshButton extends StatefulWidget {
  final bool isRefreshing;
  final VoidCallback onPressed;

  const _AnimatedRefreshButton({
    required this.isRefreshing,
    required this.onPressed,
  });

  @override
  State<_AnimatedRefreshButton> createState() => _AnimatedRefreshButtonState();
}

class _AnimatedRefreshButtonState extends State<_AnimatedRefreshButton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    );
    if (widget.isRefreshing) {
      _controller.repeat();
    }
  }

  @override
  void didUpdateWidget(covariant _AnimatedRefreshButton oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isRefreshing && !_controller.isAnimating) {
      _controller.repeat();
    } else if (!widget.isRefreshing && _controller.isAnimating) {
      _controller.stop();
      _controller.reset();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: 'Aktualisieren',
      onPressed: widget.isRefreshing ? null : widget.onPressed,
      icon: RotationTransition(
        turns: _controller,
        child: Icon(
          Icons.refresh,
          color: widget.isRefreshing ? AppColors.primary : AppColors.textMuted,
          size: 22,
        ),
      ),
    );
  }
}
