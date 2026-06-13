import 'package:flutter/material.dart';
import 'package:recruit_edge/theme/app_theme.dart';

class GlassCard extends StatelessWidget {
  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry? margin;

  const GlassCard({super.key, required this.child, this.onTap, this.margin});

  @override
  Widget build(BuildContext context) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    final backgroundColor = isDarkMode ? Colors.white.withOpacity(0.06) : Colors.white.withOpacity(0.85);
    final borderColor = isDarkMode ? Colors.white.withOpacity(0.08) : Colors.white.withOpacity(0.12);
    final boxShadow = isDarkMode ? const Color.fromRGBO(0, 0, 0, 0.4) : const Color.fromRGBO(0, 0, 0, 0.2);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: margin ?? const EdgeInsets.symmetric(vertical: 8.0, horizontal: 16.0),
        decoration: BoxDecoration(
          color: backgroundColor,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: borderColor),
          boxShadow: [
            BoxShadow(
              color: boxShadow,
              blurRadius: 32,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Material( // Added Material widget here
          type: MaterialType.transparency,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: child,
          ),
        ),
      ),
    );
  }
}
