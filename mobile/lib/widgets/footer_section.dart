import 'package:flutter/material.dart';
import 'package:recruit_edge/theme/app_theme.dart';

class FooterSection extends StatelessWidget {
  const FooterSection({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24.0),
      color: Theme.of(context).brightness == Brightness.dark ? darkBackgroundFrom : Colors.grey[100],
      child: Column(
        children: [
          Text(
            'Recruit Edge © 2025',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontSize: 14),
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 24.0,
            runSpacing: 8.0,
            alignment: WrapAlignment.center,
            children: [
              TextButton(
                onPressed: () => print('Privacy Policy tapped'),
                child: Text('Privacy Policy', style: Theme.of(context).textTheme.bodyMedium),
              ),
              TextButton(
                onPressed: () => print('Terms of Service tapped'),
                child: Text('Terms of Service', style: Theme.of(context).textTheme.bodyMedium),
              ),
              TextButton(
                onPressed: () => print('Contact Us tapped'),
                child: Text('Contact Us', style: Theme.of(context).textTheme.bodyMedium),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
