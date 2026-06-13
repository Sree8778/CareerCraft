import 'package:flutter/material.dart';
import 'package:recruit_edge/api/api_service.dart'; // New path
import 'package:recruit_edge/models/testimonial.dart'; // New path
import 'package:recruit_edge/widgets/glass_card.dart'; // New path

class TestimonialsPage extends StatefulWidget {
  const TestimonialsPage({super.key});

  @override
  State<TestimonialsPage> createState() => _TestimonialsPageState();
}

class _TestimonialsPageState extends State<TestimonialsPage> {
  late Future<List<Testimonial>> _futureTestimonials;

  @override
  void initState() {
    super.initState();
    _futureTestimonials = fetchTestimonials();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: FutureBuilder<List<Testimonial>>(
        future: _futureTestimonials,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          } else if (snapshot.hasError) {
            return Center(child: Text('Error: ${snapshot.error}'));
          } else if (snapshot.hasData) {
            return ListView.builder(
              itemCount: snapshot.data!.length,
              itemBuilder: (context, index) {
                final testimonial = snapshot.data![index];
                return GlassCard(
                  child: ListTile(
                    title: Text(testimonial.quote, style: Theme.of(context).textTheme.bodyLarge),
                    subtitle: Text('${testimonial.name}, ${testimonial.title} ${testimonial.emoji}', style: Theme.of(context).textTheme.bodyMedium),
                  ),
                );
              },
            );
          } else {
            return const Center(child: Text('No testimonials found.'));
          }
        },
      ),
    );
  }
}