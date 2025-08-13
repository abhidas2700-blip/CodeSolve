import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

export default function Contact() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate sending the form
    setTimeout(() => {
      // Reset form
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
      setIsSubmitting(false);
      
      // Show success message
      toast({
        title: "Message Sent",
        description: "Thank you for your message. We'll get back to you soon.",
      });
    }, 1500);
  };

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold tracking-tight mb-6">Contact Us</h1>
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Send Us a Message</CardTitle>
            <CardDescription>
              We'd love to hear from you. Please fill out the form below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="What is your message regarding?"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Please provide details about your inquiry..."
                  rows={5}
                  required
                />
              </div>
              
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Sending...' : 'Send Message'}
              </Button>
            </form>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-medium text-lg">Customer Support</h3>
              <div className="space-y-2 mt-2">
                <p className="flex items-center">
                  <span className="font-medium w-20">Email:</span>
                  <span>support@qualithor.com</span>
                </p>
                <p className="flex items-center">
                  <span className="font-medium w-20">Phone:</span>
                  <span>+1 (555) 123-4567</span>
                </p>
                <p className="flex items-center">
                  <span className="font-medium w-20">Hours:</span>
                  <span>Monday - Friday, 9:00 AM - 5:00 PM EST</span>
                </p>
              </div>
            </div>
            
            <div>
              <h3 className="font-medium text-lg">Sales Inquiries</h3>
              <div className="space-y-2 mt-2">
                <p className="flex items-center">
                  <span className="font-medium w-20">Email:</span>
                  <span>sales@qualithor.com</span>
                </p>
                <p className="flex items-center">
                  <span className="font-medium w-20">Phone:</span>
                  <span>+1 (555) 987-6543</span>
                </p>
              </div>
            </div>
            
            <div>
              <h3 className="font-medium text-lg">Headquarters</h3>
              <div className="space-y-2 mt-2">
                <p>
                  123 Quality Street<br />
                  Suite 456<br />
                  San Francisco, CA 94107<br />
                  United States
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}