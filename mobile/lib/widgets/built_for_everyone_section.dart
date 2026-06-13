import 'package:flutter/material.dart';
import 'package:recruit_edge/theme/app_theme.dart';
import 'package:recruit_edge/widgets/glass_card.dart';

class BuiltForEveryoneSection extends StatelessWidget {
  const BuiltForEveryoneSection({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Text(
            'Built For Everyone',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(fontSize: 28),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          Column(
            children: [
              GlassCard(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    children: [
                      Icon(Icons.person_outline, size: 48, color: Theme.of(context).primaryColor),
                      const SizedBox(height: 12),
                      Text(
                        'For Job Seekers',
                        style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.bold),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Discover personalized job recommendations and streamline your application process.',
                        style: Theme.of(context).textTheme.bodyMedium,
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16), // Spacing between cards
              GlassCard(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    children: [
                      Icon(Icons.business_center_outlined, size: 48, color: Theme.of(context).primaryColor),
                      const SizedBox(height: 12),
                      Text(
                        'For Recruiters',
                        style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.bold),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Access a curated talent pool and powerful tools to find the perfect candidate faster.',
                        style: Theme.of(context).textTheme.bodyMedium,
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
