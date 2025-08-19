import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Quote, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from "@/contexts/TranslationContext";

interface Testimonial {
  quoteKey: string;
  author: string;
  role: string;
  company: string;
  avatar: string;
  rating: number;
  industry?: string;
}

const TestimonialCarousel: React.FC = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [autoplay, setAutoplay] = useState(true);

  const { t } = useTranslation();
  
  const testimonials: Testimonial[] = [
    {
      quoteKey: "testimonial_quote_1",
      author: "Sarah Johnson",
      role: "Operations Director",
      company: "Global Logistics Inc.",
      avatar: "SJ",
      rating: 5,
      industry: "Logistics"
    },
    {
      quoteKey: "testimonial_quote_2",
      author: "Michael Chen",
      role: "Fleet Manager",
      company: "TransCorp Solutions",
      avatar: "MC",
      rating: 5,
      industry: "Transportation"
    },
    {
      quoteKey: "testimonial_quote_3",
      author: "Priya Patel",
      role: "Compliance Officer",
      company: "Enterprise Systems Ltd",
      avatar: "PP",
      rating: 4,
      industry: "Technology"
    },
    {
      quoteKey: "testimonial_quote_4",
      author: "David Rodriguez",
      role: "CFO",
      company: "Meridian Manufacturing",
      avatar: "DR",
      rating: 5,
      industry: "Manufacturing"
    },
    {
      quoteKey: "testimonial_quote_5",
      author: "Emma Wilson",
      role: "Supply Chain Manager",
      company: "Hospitality Group International",
      avatar: "EW",
      rating: 5,
      industry: "Hospitality"
    }
  ];

  useEffect(() => {
    if (!autoplay) return;
    
    const interval = setInterval(() => {
      setActiveIndex((current) => (current + 1) % testimonials.length);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [autoplay, testimonials.length]);

  const handlePrevious = () => {
    setAutoplay(false);
    setActiveIndex((current) => (current - 1 + testimonials.length) % testimonials.length);
  };

  const handleNext = () => {
    setAutoplay(false);
    setActiveIndex((current) => (current + 1) % testimonials.length);
  };

  const handleDotClick = (index: number) => {
    setAutoplay(false);
    setActiveIndex(index);
  };

  return (
    <div className="py-12 relative">
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto">
          {/* Main testimonial display */}
          <div className="relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeIndex}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
                className="relative"
              >
                <Card className="border border-primary/10 shadow-xl relative overflow-hidden bg-gradient-to-br from-background to-primary/5">
                  {/* Background decorative elements */}
                  <div className="absolute top-0 right-0 -mt-10 -mr-10 text-primary/5">
                    <Quote size={150} />
                  </div>
                  <div className="absolute bottom-0 left-0 -mb-10 -ml-10 text-primary/5 transform rotate-180">
                    <Quote size={100} />
                  </div>
                  
                  <CardContent className="pt-10 pb-10 px-8 md:px-12 relative z-10">
                    <div className="flex flex-col md:flex-row gap-8 items-center">
                      <div className="md:w-1/3 flex flex-col items-center text-center">
                        <Avatar className="h-24 w-24 mb-4 border-4 border-primary/20 shadow-lg">
                          <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                            {testimonials[activeIndex].avatar}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-bold text-xl mb-1">{testimonials[activeIndex].author}</p>
                          <p className="text-sm text-muted-foreground mb-2">
                            {testimonials[activeIndex].role}
                          </p>
                          <p className="text-sm font-medium text-primary">
                            {testimonials[activeIndex].company}
                          </p>
                          
                          {testimonials[activeIndex].industry && (
                            <Badge className="mt-3 bg-primary/10 text-primary border-primary/20">
                              {testimonials[activeIndex].industry}
                            </Badge>
                          )}
                          
                          <div className="flex items-center justify-center mt-4">
                            {[...Array(5)].map((_, i) => (
                              <Star 
                                key={i} 
                                className={`h-4 w-4 ${i < testimonials[activeIndex].rating ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground'}`} 
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      <div className="md:w-2/3">
                        <div className="mb-6">
                          <Quote className="h-10 w-10 text-primary/40 mb-4" />
                          <p className="text-lg md:text-xl italic text-foreground leading-relaxed">
                            {t(testimonials[activeIndex].quoteKey)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </AnimatePresence>
            
            {/* Navigation buttons */}
            <div className="absolute top-1/2 left-0 right-0 -mt-6 flex justify-between px-4 z-20">
              <Button 
                variant="outline" 
                size="icon" 
                className="rounded-full bg-background/80 backdrop-blur-sm border-primary/20 shadow-lg hover:bg-primary/10"
                onClick={handlePrevious}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              
              <Button 
                variant="outline" 
                size="icon" 
                className="rounded-full bg-background/80 backdrop-blur-sm border-primary/20 shadow-lg hover:bg-primary/10"
                onClick={handleNext}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
          
          {/* Testimonial navigation dots */}
          <div className="flex justify-center mt-6 space-x-2">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => handleDotClick(index)}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  index === activeIndex 
                    ? 'bg-primary scale-125' 
                    : 'bg-primary/20 hover:bg-primary/40'
                }`}
                aria-label={`Go to testimonial ${index + 1}`}
              />
            ))}
          </div>
          
          {/* Testimonial thumbnails */}
          <div className="mt-8 hidden md:flex justify-center gap-4">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                whileHover={{ y: -5 }}
                whileTap={{ scale: 0.95 }}
                className={`cursor-pointer transition-all duration-300 ${
                  index === activeIndex ? 'opacity-100 scale-105' : 'opacity-50 hover:opacity-80'
                }`}
                onClick={() => handleDotClick(index)}
              >
                <Avatar className="h-12 w-12 border-2 border-primary/20">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {testimonial.avatar}
                  </AvatarFallback>
                </Avatar>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestimonialCarousel;