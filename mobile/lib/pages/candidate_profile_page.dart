import 'package:flutter/material.dart';
import 'package:recruit_edge/theme/app_theme.dart';
import 'package:recruit_edge/widgets/glass_card.dart';

class CandidateProfilePage extends StatelessWidget {
  const CandidateProfilePage({super.key});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'My Profile',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 20),
          GlassCard(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Name: John Doe', style: Theme.of(context).textTheme.bodyLarge),
                  const SizedBox(height: 8),
                  Text('Email: john.doe@example.com', style: Theme.of(context).textTheme.bodyMedium),
                  const SizedBox(height: 8),
                  Text('Phone: +1 (555) 123-4567', style: Theme.of(context).textTheme.bodyMedium),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () {
                      // Handle edit profile
                    },
                    child: const Text('Edit Profile'),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          Text(
            'Resume',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 10),
          GlassCard(
            child: ListTile(
              leading: const Icon(Icons.description),
              title: Text('My_Resume_2025.pdf', style: Theme.of(context).textTheme.bodyLarge),
              trailing: const Icon(Icons.download),
              onTap: () {
                // Handle resume download/view
              },
            ),
          ),
          ElevatedButton(
            onPressed: () {
              // Handle upload new resume
            },
            child: const Text('Upload New Resume'),
          ),
        ],
      ),
    );
  }
}