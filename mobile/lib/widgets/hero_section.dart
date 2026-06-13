import 'package:flutter/material.dart';
import 'package:recruit_edge/theme/app_theme.dart';
import 'package:recruit_edge/widgets/glass_card.dart'; // For button styling

class HeroSection extends StatelessWidget {
  const HeroSection({super.key});

  @override
  Widget build(BuildContext context) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;

    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Text(
            'Your Gateway to Career Excellence',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(fontSize: 32),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          Text(
            'Connecting top talent with leading companies. Find your dream job or the perfect candidate, effortlessly.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontSize: 16),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 32),
          Wrap(
            spacing: 16.0, // Horizontal space between buttons
            runSpacing: 16.0, // Vertical space between wrapped lines
            alignment: WrapAlignment.center,
            children: [
              ElevatedButton(
                onPressed: () {
                  // Action for "Find a Job"
                  print('Find a Job tapped');
                },
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                child: const Text('Find a Job', style: TextStyle(fontSize: 18)),
              ),
              ElevatedButton(
                onPressed: () {
                  // Action for "Post a Job"
                  print('Post a Job tapped');
                },
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  backgroundColor: isDarkMode ? darkMutedTextColor : mutedTextColor, // Example secondary color
                  foregroundColor: isDarkMode ? darkPrimaryTextColor : primaryTextColor,
                ),
                child: const Text('Post a Job', style: TextStyle(fontSize: 18)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
