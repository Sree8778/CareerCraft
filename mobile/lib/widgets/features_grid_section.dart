import 'package:flutter/material.dart';
import 'package:recruit_edge/theme/app_theme.dart';
import 'package:recruit_edge/widgets/glass_card.dart';

class FeaturesGridSection extends StatelessWidget {
  const FeaturesGridSection({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Text(
            'Why Choose Recruit Edge?',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(fontSize: 28),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(), // Disable GridView's own scrolling
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2, // 2 columns for mobile
              crossAxisSpacing: 16.0,
              mainAxisSpacing: 16.0,
              childAspectRatio: 0.8, // Adjust aspect ratio for content
            ),
            itemCount: 4, // Assuming 4 features as per web app
            itemBuilder: (context, index) {
              // Placeholder data for features, replace with actual data if available
              final features = [
                {'icon': Icons.flash_on, 'title': 'Speed & Efficiency', 'desc': 'Accelerate your hiring or job search process.'},
                {'icon': Icons.security, 'title': 'Secure & Private', 'desc': 'Your data is protected with industry-leading security.'},
                {'icon': Icons.star, 'title': 'Top Matches', 'desc': 'Smart algorithms connect the right talent with the right roles.'},
                {'icon': Icons.support, 'title': 'Dedicated Support', 'desc': 'Our team is here to assist you every step of the way.'},
              ];
              final feature = features[index];

              return GlassCard(
                margin: EdgeInsets.zero,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(feature['icon'] as IconData, size: 48, color: Theme.of(context).primaryColor),
                    const SizedBox(height: 12),
                    Text(
                      feature['title'] as String,
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.bold),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      feature['desc'] as String,
                      style: Theme.of(context).textTheme.bodyMedium,
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}
