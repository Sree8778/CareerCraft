import 'package:flutter/material.dart';
import 'package:recruit_edge/theme/app_theme.dart';
import 'package:recruit_edge/widgets/glass_card.dart';

class RecruiterRequisitionsPage extends StatelessWidget {
  const RecruiterRequisitionsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'My Requisitions',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 20),
          GlassCard(
            child: ListTile(
              title: Text('Software Engineer (Senior)', style: Theme.of(context).textTheme.bodyLarge),
              subtitle: Text('Open: 5 applications', style: Theme.of(context).textTheme.bodyMedium),
              trailing: const Icon(Icons.arrow_forward_ios),
              onTap: () {
                // Navigate to requisition details
                // Example: Navigator.push(context, MaterialPageRoute(builder: (context) => RequisitionDetailsPage()));
              },
            ),
          ),
          GlassCard(
            child: ListTile(
              title: Text('Product Manager (Mid-Level)', style: Theme.of(context).textTheme.bodyLarge),
              subtitle: Text('Open: 12 applications', style: Theme.of(context).textTheme.bodyMedium),
              trailing: const Icon(Icons.arrow_forward_ios),
              onTap: () {
                // Navigate to requisition details
                // Example: Navigator.push(context, MaterialPageRoute(builder: (context) => RequisitionDetailsPage()));
              },
            ),
          ),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: () {
              // Navigate to create new requisition
              // Example: Navigator.push(context, MaterialPageRoute(builder: (context) => CreateRequisitionPage()));
            },
            child: const Text('Create New Requisition'),
          ),
        ],
      ),
    );
  }
}