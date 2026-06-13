import 'package:flutter/material.dart';

class ThemeToggle extends StatelessWidget {
  final ThemeMode currentThemeMode;
  final ValueChanged<ThemeMode> onToggle;

  const ThemeToggle({
    super.key,
    required this.currentThemeMode,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    return IconButton(
      icon: Icon(
        currentThemeMode == ThemeMode.dark ? Icons.light_mode : Icons.dark_mode,
        color: Theme.of(context).textTheme.titleLarge?.color,
      ),
      onPressed: () {
        onToggle(
          currentThemeMode == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark,
        );
      },
    );
  }
}