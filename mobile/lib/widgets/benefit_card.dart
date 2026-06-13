import 'package:flutter/material.dart';
import 'package:flutter_iconly/flutter_iconly.dart'; // For icons
import 'package:recruit_edge/models/benefit.dart'; // For Benefit model
import 'package:recruit_edge/widgets/glass_card.dart'; // To wrap with GlassCard

class BenefitCard extends StatelessWidget {
  final Benefit benefit;

  const BenefitCard({super.key, required this.benefit});

  // Helper function to map the icon name string to a Flutter Icon
  IconData _getIconFromString(String iconName) {
    switch (iconName) {
      case 'UsersIcon':
        return IconlyBold.profile;
      case 'ActivitySquareIcon':
        return IconlyBold.activity;
      case 'ShieldIcon':
        return IconlyBold.shieldDone;
      case 'RocketIcon':
        return IconlyBold.send;
      default:
        return Icons.help_outline;
    }
  }

  @override
  Widget build(BuildContext context) {
    // Determine icon color based on theme brightness
    final iconColor = Theme.of(context).brightness == Brightness.dark
        ? Theme.of(context).textTheme.bodyLarge?.color // Use dark primary text color
        : Theme.of(context).primaryColor; // Use a primary color for light mode

    return GlassCard(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Icon
            Icon(
              _getIconFromString(benefit.icon),
              size: 36, // Larger icon size
              color: iconColor,
            ),
            const SizedBox(height: 12),
            // Title
            Text(
              benefit.title,
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    fontWeight: FontWeight.bold,
                    fontSize: 18,
                  ),
            ),
            const SizedBox(height: 8),
            // Description
            Text(
              benefit.desc,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ],
        ),
      ),
    );
  }
}