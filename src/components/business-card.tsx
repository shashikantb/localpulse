
import type { FC } from 'react';
import type { BusinessUser } from '@/lib/db-types';
import { Card, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Phone, MapPin, Briefcase } from 'lucide-react';

interface BusinessCardProps {
  business: BusinessUser;
  userLocation: { latitude: number; longitude: number } | null;
}

const BusinessCard: FC<BusinessCardProps> = ({ business, userLocation }) => {
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const distanceInKm = business.distance ? (business.distance / 1000).toFixed(1) : null;

  return (
    <Card className="shadow-lg hover:shadow-primary/20 transition-shadow duration-300">
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Avatar className="h-20 w-20 border-4 border-primary/20">
            <AvatarImage src={business.profilepictureurl || undefined} alt={business.name} />
            <AvatarFallback className="text-2xl bg-muted">{getInitials(business.name)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 text-center sm:text-left">
            <h3 className="text-xl font-bold text-primary">{business.name}</h3>
            <p className="text-sm text-muted-foreground flex items-center justify-center sm:justify-start gap-2 mt-1">
              <Briefcase className="w-4 h-4" />
              {business.business_category === 'Any Other' ? business.business_other_category : business.business_category}
            </p>
            {distanceInKm !== null && (
                <p className="text-xs text-accent font-semibold flex items-center justify-center sm:justify-start gap-1.5 mt-1">
                    <MapPin className="w-3 h-3"/>
                    Approx. {distanceInKm} km away
                </p>
            )}
          </div>
          <div className="flex flex-col gap-2 w-full sm:w-auto">
            {business.mobilenumber && (
              <a href={`tel:${business.mobilenumber}`}>
                <Button className="w-full">
                  <Phone className="mr-2 h-4 w-4" />
                  Call Now
                </Button>
              </a>
            )}
          </div>
        </div>
      </CardHeader>
    </Card>
  );
};

export default BusinessCard;
