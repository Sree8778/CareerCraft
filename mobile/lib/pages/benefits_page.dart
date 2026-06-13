import 'package:flutter/material.dart';
// import 'package:flutter_iconly/flutter_iconly.dart'; // No longer needed here as it's in BenefitCard
import 'package:recruit_edge/api/api_service.dart';
import 'package:recruit_edge/models/benefit.dart';
// import 'package:recruit_edge/widgets/glass_card.dart'; // No longer directly needed here as BenefitCard wraps it
import 'package:recruit_edge/widgets/benefit_card.dart'; // Import the new BenefitCard

class BenefitsPage extends StatefulWidget {
  const BenefitsPage({super.key});

  @override
  State<BenefitsPage> createState() => _BenefitsPageState();
}

class _BenefitsPageState extends State<BenefitsPage> {
  late Future<List<Benefit>> _futureBenefits;

  @override
  void initState() {
    super.initState();
    _futureBenefits = fetchBenefits();
  }

  // Removed: Helper function to map the icon name string to a Flutter Icon
  // This logic is now encapsulated within BenefitCard.

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: FutureBuilder<List<Benefit>>(
        future: _futureBenefits,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          } else if (snapshot.hasError) {
            return Center(child: Text('Error: ${snapshot.error}'));
          } else if (snapshot.hasData) {
            return ListView.builder(
              itemCount: snapshot.data!.length,
              itemBuilder: (context, index) {
                final benefit = snapshot.data![index];
                return BenefitCard(benefit: benefit); // Use the new BenefitCard
              },
            );
          } else {
            return const Center(child: Text('No benefits found.'));
          }
        },
      ),
    );
  }
}