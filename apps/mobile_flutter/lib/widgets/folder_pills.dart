import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class FolderItem {
  final String key;
  final String label;
  final IconData icon;

  const FolderItem({
    required this.key,
    required this.label,
    required this.icon,
  });
}

class FolderPills extends StatelessWidget {
  final String activeFolder;
  final ValueChanged<String> onFolderSelected;
  final int unreadCount;
  final Map<String, int>? folderUnreadCounts;

  static const List<FolderItem> defaultFolders = [
    FolderItem(
      key: 'inbox',
      label: 'Posteingang',
      icon: Icons.inbox_rounded,
    ),
    FolderItem(
      key: 'sent',
      label: 'Gesendet',
      icon: Icons.send_rounded,
    ),
    FolderItem(
      key: 'archive',
      label: 'Archiv',
      icon: Icons.archive_outlined,
    ),
    FolderItem(
      key: 'trash',
      label: 'Papierkorb',
      icon: Icons.delete_outline_rounded,
    ),
  ];

  FolderPills({
    super.key,
    String? activeFolder,
    String? selectedFolder,
    ValueChanged<String>? onFolderSelected,
    ValueChanged<String>? onSelectFolder,
    this.unreadCount = 0,
    this.folderUnreadCounts,
  })  : activeFolder = selectedFolder ?? activeFolder ?? 'inbox',
        onFolderSelected = onSelectFolder ?? onFolderSelected ?? ((_) {});

  int _getUnreadForFolder(String key) {
    if (folderUnreadCounts != null && folderUnreadCounts!.containsKey(key)) {
      return folderUnreadCounts![key] ?? 0;
    }
    if (key == 'inbox') {
      return unreadCount;
    }
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 52.0,
      color: Colors.white,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
        child: Row(
          children: [
            for (int i = 0; i < defaultFolders.length; i++) ...[
              if (i > 0) const SizedBox(width: 8.0),
              _buildPill(
                context: context,
                folder: defaultFolders[i],
                isActive: defaultFolders[i].key == activeFolder,
                unreadCount: _getUnreadForFolder(defaultFolders[i].key),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildPill({
    required BuildContext context,
    required FolderItem folder,
    required bool isActive,
    required int unreadCount,
  }) {
    const primaryBlue = Color(0xFF3661A4);
    const inactiveBg = Color(0xFFF1F5F9);
    const inactiveText = Color(0xFF475569);
    const borderColor = Color(0xFFE2E8F0);

    return Semantics(
      button: true,
      selected: isActive,
      label: unreadCount > 0
          ? '${folder.label}, $unreadCount ungelesen'
          : folder.label,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => onFolderSelected(folder.key),
          borderRadius: BorderRadius.circular(20.0),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            padding:
                const EdgeInsets.symmetric(horizontal: 14.0, vertical: 6.0),
            decoration: BoxDecoration(
              color: isActive ? primaryBlue : inactiveBg,
              borderRadius: BorderRadius.circular(20.0),
              border: Border.all(
                color: isActive ? primaryBlue : borderColor,
                width: 1.0,
              ),
              boxShadow: isActive
                  ? [
                      BoxShadow(
                        color: primaryBlue.withValues(alpha: 0.25),
                        blurRadius: 4.0,
                        offset: const Offset(0, 2),
                      ),
                    ]
                  : null,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  folder.icon,
                  size: 16.0,
                  color: isActive ? Colors.white : inactiveText,
                ),
                const SizedBox(width: 6.0),
                Text(
                  folder.label,
                  style: GoogleFonts.poppins(
                    fontSize: 13.0,
                    fontWeight: isActive ? FontWeight.w600 : FontWeight.w500,
                    color: isActive ? Colors.white : inactiveText,
                  ),
                ),
                if (unreadCount > 0) ...[
                  const SizedBox(width: 6.0),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 6.0,
                      vertical: 1.5,
                    ),
                    decoration: BoxDecoration(
                      color: isActive ? Colors.white : primaryBlue,
                      borderRadius: BorderRadius.circular(10.0),
                    ),
                    child: Text(
                      unreadCount > 99 ? '99+' : '$unreadCount',
                      style: GoogleFonts.poppins(
                        fontSize: 11.0,
                        fontWeight: FontWeight.w700,
                        color: isActive ? primaryBlue : Colors.white,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
