import { GraduationCap, Package, Users, BookOpen, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";

const NewFeaturesSection = () => {
  const { language } = useLanguage();

  const features = [
    {
      icon: <GraduationCap size={28} />,
      title: language === 'en' ? 'Schools Space' : 'Espace Écoles',
      description: language === 'en'
        ? 'Find your school, access official supply lists and order in one click.'
        : 'Trouvez votre école, accédez aux listes officielles et commandez en un clic.',
      href: '/ecoles',
      color: 'from-blue-500/20 to-blue-600/10',
      iconBg: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    },
    {
      icon: <Package size={28} />,
      title: language === 'en' ? 'Smart Kits' : 'Kits Intelligents',
      description: language === 'en'
        ? 'Auto-generated school kits based on grade level and series.'
        : 'Kits scolaires auto-générés selon le niveau et la série.',
      href: '/kits',
      color: 'from-emerald-500/20 to-emerald-600/10',
      iconBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    },
    {
      icon: <Users size={28} />,
      title: language === 'en' ? 'Referral Program' : 'Programme Parrainage',
      description: language === 'en'
        ? 'Invite friends, earn credits. Up to 2,000 FCFA per referral!'
        : 'Invitez vos amis, gagnez des crédits. Jusqu\'à 2 000 FCFA par filleul !',
      href: '/parrainage',
      color: 'from-amber-500/20 to-amber-600/10',
      iconBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    },
    {
      icon: <BookOpen size={28} />,
      title: language === 'en' ? 'Educational Resources' : 'Ressources Éducatives',
      description: language === 'en'
        ? 'Exercises, past exams, videos — free and premium content.'
        : 'Exercices, anciens sujets, vidéos — contenus gratuits et premium.',
      href: '/ressources',
      color: 'from-purple-500/20 to-purple-600/10',
      iconBg: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
    },
  ];

  return (
    <section className="py-5 lg:py-8 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-6">
          <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-2">
            🆕 {language === 'en' ? 'New' : 'Nouveau'}
          </span>
          <h2 className="text-2xl lg:text-3xl font-display font-bold text-foreground mb-1">
            {language === 'en' ? 'Discover our new features' : 'Découvrez nos nouveautés'}
          </h2>
          <p className="text-muted-foreground text-sm">
            {language === 'en'
              ? 'Tools designed to simplify the school year.'
              : 'Des outils pensés pour simplifier la rentrée.'}
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {features.map((f, i) => (
            <Link
              key={i}
              to={f.href}
              className={`group relative p-3 sm:p-4 rounded-xl border border-border bg-gradient-to-br ${f.color} hover:shadow-md hover:border-primary/30 transition-all`}
            >
              <div className={`w-10 h-10 rounded-lg ${f.iconBg} flex items-center justify-center mb-2`}>
                {f.icon}
              </div>
              <h3 className="text-sm font-display font-bold text-foreground mb-1 leading-tight">{f.title}</h3>
              <p className="text-xs text-muted-foreground mb-2 leading-snug line-clamp-2">{f.description}</p>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-primary group-hover:gap-2 transition-all">
                {language === 'en' ? 'Explore' : 'Explorer'}
                <ArrowRight size={12} />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default NewFeaturesSection;
