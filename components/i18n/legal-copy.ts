type LegalSection = { title: string; paragraphs: string[] };
type LegalCopy = {
  legal: string; updated: string;
  terms: { title: string; notice: string; sections: LegalSection[] };
  privacy: { title: string; notice: string; sections: { title: string; body: string }[] };
  cancellation: {
    title: string; intro: string; notice: string; when: string; refund: string;
    rules: { timing: string; result: string }[]; sections: LegalSection[];
  };
};
const fr: LegalCopy = {
  legal: "Informations légales", updated: "Dernière mise à jour",
  terms: {
    title: "Conditions générales de service",
    notice: "Ce document est un projet destiné aux clients du service de transport SAIWAY au Cambodge. Il doit être examiné et approuvé par un juriste cambodgien qualifié avant le lancement, notamment après la finalisation de l’entité juridique, des licences, du prestataire de paiement et des partenaires de transport.",
    sections: [
      { title: "1. Service et accord", paragraphs: [
        "Ces conditions régissent votre utilisation de SAIWAY et toute réservation de transfert privé depuis l’aéroport ou en ville organisée sur notre site. En soumettant une réservation, vous acceptez ces conditions, le prix et les détails du trajet affichés lors de la réservation.",
        "SAIWAY est l’opérateur de réservation et de service client. Le transfert est effectué par SAIWAY ou un chauffeur indépendant ou partenaire de transport autorisé à fournir ce service au Cambodge. Les informations du chauffeur et du véhicule sont communiquées dans la confirmation lorsqu’elles sont disponibles.",
      ] },
      { title: "2. Réservation et informations des passagers", paragraphs: [
        "Vous devez fournir des informations exactes concernant les passagers, les coordonnées, le départ, la destination et le vol. Il vous appartient de vérifier la confirmation et de nous signaler rapidement toute erreur. La réservation est acceptée lorsque SAIWAY envoie une confirmation ou confirme autrement la course.",
        "La personne qui réserve confirme qu’elle est autorisée à le faire pour tous les passagers. Les passagers doivent suivre les consignes raisonnables de sécurité du chauffeur et respecter les exigences cambodgiennes de sécurité routière pendant le trajet.",
      ] },
      { title: "3. Prix et paiement", paragraphs: [
        "Le tarif total, la devise et les services inclus sont affichés avant l’envoi de la réservation. Sauf indication contraire, le tarif comprend le véhicule, le chauffeur, le nombre de passagers prévu et les conditions d’attente ordinaires indiquées dans la confirmation. Les services facultatifs, l’attente supplémentaire, les arrêts supplémentaires ou les modifications peuvent entraîner un supplément.",
        "Le paiement est dû selon le moyen présenté lors de la réservation. Nous pouvons recourir à un prestataire de paiement tiers ; ses conditions et sa politique de confidentialité s’appliquent aussi au traitement. SAIWAY ne conserve pas les coordonnées complètes des cartes bancaires, sauf indication explicite dans le parcours du prestataire.",
      ] },
      { title: "4. Prise en charge à l’aéroport et retards", paragraphs: [
        "Pour un départ de l’aéroport, indiquez votre numéro de vol si possible. Nous pouvons utiliser les informations du vol pour suivre l’arrivée prévue. Respectez les instructions de rendez-vous de la confirmation et gardez votre téléphone joignable.",
        "Le temps d’attente raisonnable inclus et le traitement des retards de vol sont indiqués dans la confirmation ou la politique d’annulation. Si nous ne pouvons pas vous trouver après le délai applicable, la réservation peut être considérée comme une absence du passager.",
      ] },
      { title: "5. Bagages, sécurité et comportement", paragraphs: [
        "La réservation est limitée à la capacité de passagers et de bagages indiquée pour le véhicule choisi. Informez-nous à l’avance des bagages volumineux, équipements de mobilité, sièges enfants ou autres besoins particuliers. Nous pouvons refuser des bagages dangereux ou dépassant sensiblement la capacité.",
        "Il est interdit de fumer, de transporter des marchandises illégales ou dangereuses, d’endommager le véhicule, d’adopter un comportement menaçant ou de voyager sous influence d’une manière créant un risque. Nous pouvons mettre fin au trajet sans remboursement lorsque la sécurité ou la loi l’exige raisonnablement.",
      ] },
      { title: "6. Modifications, annulation et remboursements", paragraphs: [
        "Les modifications et annulations sont traitées selon la politique publiée sur ce site et les conditions particulières de votre confirmation. Lorsqu’un remboursement est dû, il est normalement effectué sur le moyen de paiement initial, sous réserve des délais du prestataire.",
        "Si SAIWAY annule un transfert confirmé et ne peut proposer un remplacement adapté, vous pouvez choisir un remboursement intégral ou une autre solution convenue avec nous.",
      ] },
      { title: "7. Responsabilité et limites", paragraphs: [
        "Nous organiserons le service réservé avec une diligence raisonnable. Nous ne sommes pas responsables des retards ou défaillances dus à des événements hors de notre contrôle raisonnable : intempéries, fermetures de routes, incidents de circulation, urgences publiques, décisions gouvernementales, grèves ou informations inexactes fournies par un passager.",
        "Ces conditions n’excluent ni ne limitent les responsabilités qui ne peuvent légalement l’être selon le droit cambodgien, notamment en cas de décès ou blessure causés par négligence, fraude ou autres protections obligatoires des consommateurs. Sous réserve de ces droits, SAIWAY n’est pas responsable des pertes indirectes, correspondances manquées ou pertes dues au non-respect des instructions par un passager.",
      ] },
      { title: "8. Droit applicable et contact", paragraphs: [
        "Ces conditions doivent être appliquées conformément aux règles cambodgiennes, notamment la loi sur la protection des consommateurs (2019), la loi sur le commerce électronique (2019), la loi sur la circulation routière (2014), le Code civil et les exigences de licence ou de transport de passagers applicables. Toute règle impérative contraire prévaut.",
        "Ces conditions sont régies par le droit du Royaume du Cambodge. Nous chercherons d’abord à résoudre les réclamations de bonne foi. Un litige non résolu peut être soumis à un tribunal compétent au Cambodge, sous réserve des droits impératifs du consommateur.",
        "Pour toute question, modification ou réclamation, contactez SAIWAY avec les coordonnées indiquées dans votre confirmation et mentionnez la référence de réservation.",
      ] },
    ],
  },
  privacy: {
    title: "Politique de confidentialité",
    notice: "Ce document est un projet pratique pour le service cambodgien de SAIWAY et doit être examiné par un juriste cambodgien qualifié avant publication. Les informations provisoires de l’opérateur doivent être remplacées par l’entité juridique et les coordonnées définitives.",
    sections: [
      { title: "1. Responsable de vos informations", body: "SAIWAY est responsable des données personnelles collectées sur ce site et utilisées pour organiser votre transfert. Le nom définitif de l’opérateur, son adresse enregistrée et son e-mail doivent être ajoutés avant le lancement afin que les clients puissent contacter l’entité cambodgienne concernée." },
      { title: "2. Informations collectées", body: "Nous pouvons collecter vos nom, e-mail, téléphone, référence de réservation, départ et destination, numéro de vol, nombre de passagers, besoins de bagages ou d’accessibilité, statut du paiement, messages et informations nécessaires au trajet. Nous pouvons aussi recevoir la position du véhicule ou le statut du trajet d’un chauffeur ou partenaire pendant un transfert actif." },
      { title: "3. Utilisation des informations", body: "Nous utilisons ces informations pour créer et gérer les réservations, communiquer les confirmations et modifications, coordonner les chauffeurs, fournir le suivi en direct, traiter paiements et remboursements, répondre aux demandes d’aide, prévenir la fraude ou les abus, conserver les documents professionnels et respecter les obligations cambodgiennes légales, fiscales, comptables et de transport routier. Nous ne vendons pas les données personnelles des passagers." },
      { title: "4. Partage", body: "Nous partageons uniquement les informations raisonnablement nécessaires avec le chauffeur ou partenaire affecté, les prestataires de paiement et de technologie, le service client, les assureurs ou conseillers et les autorités lorsque la loi ou la sécurité l’exige. Les prestataires doivent utiliser les informations pour le service convenu et les protéger de manière appropriée." },
      { title: "5. Position et informations de vol", body: "Si vous fournissez un numéro de vol, nous pouvons l’utiliser pour estimer l’arrivée et organiser la prise en charge. Pendant un trajet actif, la position en direct peut informer le passager du statut du chauffeur et faciliter la sécurité et la répartition. Nous ne proposons pas un suivi continu hors de la réservation concernée sans consentement distinct." },
      { title: "6. Conservation et sécurité", body: "Nous conservons les réservations et transactions aussi longtemps que raisonnablement nécessaire pour le service, l’assistance, la comptabilité, les litiges et les obligations légales. Nous utilisons des protections administratives et techniques raisonnables, mais aucun système de transmission ou de stockage en ligne ne peut être garanti entièrement sûr." },
      { title: "7. Vos choix et demandes", body: "Vous pouvez nous demander l’accès, la correction ou la suppression de vos données personnelles, ou des informations sur leur utilisation. Nous pouvons vérifier votre identité et conserver les informations nécessaires pour des motifs légaux, de sécurité, comptables ou de litige. Nous expliquerons toute limitation imposée par le droit cambodgien." },
      { title: "8. Cookies et tiers", body: "Le site peut utiliser des cookies essentiels ou technologies similaires pour la sécurité, les sessions et le fonctionnement de base. Si nous ajoutons des outils d’analyse, de publicité ou non essentiels, nous fournirons les informations et choix adaptés. Les liens vers des prestataires de paiement ou d’autres sites sont régis par leurs propres politiques de confidentialité." },
      { title: "9. Contact et mises à jour", body: "Contactez SAIWAY avec les coordonnées de votre confirmation pour toute question ou demande concernant la confidentialité. Nous pouvons modifier cette politique si le service, les partenaires ou les obligations légales changent. La dernière version est publiée sur cette page avec sa date de mise à jour." },
    ],
  },
  cancellation: {
    title: "Politique d’annulation", when: "Moment de l’annulation", refund: "Remboursement",
    intro: "Cette politique s’applique aux transferts privés SAIWAY, sauf conditions différentes clairement indiquées dans votre confirmation. Elle doit être lue avec la loi cambodgienne sur la protection des consommateurs (2019), la loi sur le commerce électronique (2019), la loi sur la circulation routière (2014), le Code civil et les règles de transport de passagers applicables. Les droits d’annulation impératifs restent inchangés.",
    notice: "Ce document est un projet destiné aux clients. Un juriste cambodgien qualifié doit vérifier sa conformité avec les licences définitives de SAIWAY, sa structure d’exploitation, les conditions de paiement et les obligations de protection des consommateurs avant le lancement.",
    rules: [
      { timing: "Plus de 48 heures avant le départ", result: "Remboursement intégral du tarif du transfert." },
      { timing: "De 24 à 48 heures avant le départ", result: "Remboursement de 50 % du tarif du transfert." },
      { timing: "Moins de 24 heures avant le départ", result: "Le tarif n’est normalement pas remboursable." },
      { timing: "Absence du passager", result: "Aucun remboursement après la fin du temps d’attente inclus." },
    ],
    sections: [
      { title: "Comment annuler", paragraphs: ["Utilisez le contact d’annulation indiqué dans la confirmation et mentionnez votre référence. L’heure de réception de votre demande détermine le délai applicable. L’annulation n’est effective qu’après confirmation par SAIWAY."] },
      { title: "Modifications et report", paragraphs: ["Demandez une modification dès que possible. Nous essayerons d’accepter une nouvelle date, heure, destination ou un nouveau nombre de passagers, sous réserve des disponibilités et de toute différence tarifaire. Une modification importante peut être traitée comme une annulation suivie d’une nouvelle réservation."] },
      { title: "Retards de vol", paragraphs: ["Si un numéro de vol est fourni, SAIWAY peut suivre l’arrivée prévue et essayer d’ajuster la prise en charge. Un retard prolongé, un vol manqué ou une modification empêchant le chauffeur d’effectuer le trajet peut être traité comme une annulation ou une absence, selon les circonstances et les conditions d’attente de votre confirmation."] },
      { title: "Annulation par SAIWAY", paragraphs: ["Si SAIWAY annule un transfert confirmé sans remplacement adapté, vous pouvez choisir le remboursement intégral du montant payé pour ce transfert ou une autre solution convenue avec nous. Le délai de remboursement dépend du prestataire de paiement."] },
      { title: "Circonstances exceptionnelles", paragraphs: ["Nous envisagerons des solutions raisonnables lorsqu’un trajet est affecté par des intempéries, une fermeture de route, une urgence publique, une restriction gouvernementale ou un autre événement hors de notre contrôle raisonnable. Cette politique ne supprime aucun droit impératif du droit cambodgien."] },
    ],
  },
};
const km: LegalCopy = {
  legal: "ព័ត៌មានផ្លូវច្បាប់", updated: "កែប្រែចុងក្រោយ",
  terms: {
    title: "លក្ខខណ្ឌសេវាកម្ម",
    notice: "ឯកសារនេះជាសេចក្តីព្រាងសម្រាប់អតិថិជនសេវាដឹកជញ្ជូន SAIWAY នៅកម្ពុជា។ ត្រូវឱ្យអ្នកច្បាប់កម្ពុជាដែលមានសមត្ថភាពពិនិត្យ និងអនុម័តមុនចាប់ផ្ដើមសេវា ជាពិសេសក្រោយកំណត់នីតិបុគ្គល អាជ្ញាបណ្ណ អ្នកផ្តល់សេវាទូទាត់ និងដៃគូដឹកជញ្ជូន។",
    sections: [
      { title: "១. សេវាកម្ម និងកិច្ចព្រមព្រៀង", paragraphs: [
        "លក្ខខណ្ឌនេះគ្រប់គ្រងការប្រើប្រាស់ SAIWAY និងការកក់ដំណើរឯកជនពីអាកាសយានដ្ឋាន ឬក្នុងក្រុងតាមគេហទំព័រ។ ពេលដាក់សំណើកក់ អ្នកយល់ព្រមនឹងលក្ខខណ្ឌ តម្លៃ និងព័ត៌មានដំណើរដែលបង្ហាញពេលកក់។",
        "SAIWAY ជាអ្នកប្រតិបត្តិការកក់ និងសេវាអតិថិជន។ ការដឹកជញ្ជូនធ្វើដោយ SAIWAY ឬអ្នកបើកបរឯករាជ្យ ឬដៃគូដែលមានសិទ្ធិផ្តល់សេវានៅកម្ពុជា។ ព័ត៌មានអ្នកបើកបរ និងយានយន្តនឹងបង្ហាញក្នុងការបញ្ជាក់កក់នៅពេលមាន។",
      ] },
      { title: "២. ការកក់ និងព័ត៌មានអ្នកដំណើរ", paragraphs: [
        "អ្នកត្រូវផ្តល់ព័ត៌មានត្រឹមត្រូវអំពីអ្នកដំណើរ ទំនាក់ទំនង ទីតាំងចេញដំណើរ គោលដៅ និងជើងហោះហើរ។ អ្នកទទួលខុសត្រូវពិនិត្យការបញ្ជាក់ និងជូនដំណឹងអំពីកំហុសឱ្យបានឆាប់។ ការកក់ត្រូវបានទទួលនៅពេល SAIWAY ផ្ញើការបញ្ជាក់ ឬបញ្ជាក់ដំណើរតាមមធ្យោបាយផ្សេង។",
        "អ្នកកក់បញ្ជាក់ថាមានសិទ្ធិកក់ជំនួសអ្នកដំណើរទាំងអស់។ អ្នកដំណើរត្រូវអនុវត្តតាមការណែនាំសុវត្ថិភាពសមហេតុផលរបស់អ្នកបើកបរ និងបទប្បញ្ញត្តិសុវត្ថិភាពចរាចរណ៍កម្ពុជា។",
      ] },
      { title: "៣. តម្លៃ និងការទូទាត់", paragraphs: [
        "តម្លៃសរុប រូបិយប័ណ្ណ និងសេវារួមបញ្ចូលត្រូវបង្ហាញមុនដាក់ការកក់។ លើកលែងមានការបញ្ជាក់ផ្សេង តម្លៃរួមមានយានយន្ត អ្នកបើកបរ ចំនួនអ្នកដំណើរកំណត់ និងការរង់ចាំធម្មតាក្នុងការបញ្ជាក់។ សេវាបន្ថែម ការរង់ចាំ ឬឈប់បន្ថែម និងការកែប្រែអាចមានថ្លៃបន្ថែម។",
        "ត្រូវទូទាត់តាមមធ្យោបាយដែលបង្ហាញពេលកក់។ យើងអាចប្រើអ្នកផ្តល់សេវាទូទាត់ភាគីទីបី ហើយលក្ខខណ្ឌ និងសេចក្តីជូនដំណឹងឯកជនភាពរបស់ពួកគេក៏អនុវត្តដែរ។ SAIWAY មិនរក្សាព័ត៌មានកាតទូទាត់ពេញលេញ លើកលែងបានបញ្ជាក់ច្បាស់ក្នុងដំណើរការរបស់អ្នកផ្តល់សេវា។",
      ] },
      { title: "៤. ទទួលនៅអាកាសយានដ្ឋាន និងការយឺតយ៉ាវ", paragraphs: [
        "សម្រាប់ការទទួលនៅអាកាសយានដ្ឋាន សូមផ្តល់លេខជើងហោះហើរបើអាច។ យើងអាចប្រើព័ត៌មានហោះហើរដើម្បីតាមដានការមកដល់។ ត្រូវធ្វើតាមការណែនាំទីតាំងជួបក្នុងការបញ្ជាក់ និងរក្សាទូរស័ព្ទឱ្យអាចទាក់ទងបាន។",
        "រយៈពេលរង់ចាំរួមបញ្ចូល និងការដោះស្រាយជើងហោះហើរយឺត ត្រូវបានកំណត់ក្នុងការបញ្ជាក់ ឬគោលការណ៍លុបចោល។ បើរកអ្នកមិនឃើញក្រោយរយៈពេលកំណត់ ការកក់អាចចាត់ទុកថាអ្នកដំណើរមិនមក។",
      ] },
      { title: "៥. វ៉ាលី សុវត្ថិភាព និងអាកប្បកិរិយា", paragraphs: [
        "ការកក់កំណត់តាមសមត្ថភាពអ្នកដំណើរ និងវ៉ាលីរបស់យានយន្ត។ សូមជូនដំណឹងជាមុនអំពីវ៉ាលីធំ ឧបករណ៍ជំនួយចលនា កៅអីកុមារ ឬតម្រូវការពិសេស។ យើងអាចបដិសេធវ៉ាលីដែលមិនមានសុវត្ថិភាព ឬលើសសមត្ថភាពខ្លាំង។",
        "ហាមជក់បារី ដឹកទំនិញខុសច្បាប់ ឬគ្រោះថ្នាក់ បំផ្លាញយានយន្ត គំរាមកំហែង ឬធ្វើដំណើរក្រោមឥទ្ធិពលសារធាតុដែលបង្កហានិភ័យ។ យើងអាចបញ្ចប់ដំណើរដោយមិនសងប្រាក់នៅពេលចាំបាច់សមហេតុផលសម្រាប់សុវត្ថិភាព ឬការអនុវត្តច្បាប់។",
      ] },
      { title: "៦. ការកែប្រែ លុបចោល និងសងប្រាក់", paragraphs: [
        "ការកែប្រែ និងលុបចោលអនុវត្តតាមគោលការណ៍លើគេហទំព័រ និងលក្ខខណ្ឌពិសេសក្នុងការបញ្ជាក់។ ប្រាក់ដែលត្រូវសងជាធម្មតាត្រឡប់ទៅមធ្យោបាយទូទាត់ដើម អាស្រ័យលើពេលដំណើរការរបស់អ្នកផ្តល់សេវា។",
        "បើ SAIWAY លុបចោលដំណើរដែលបានបញ្ជាក់ និងមិនអាចផ្តល់ជំនួសសមស្រប អ្នកអាចជ្រើសសងប្រាក់ពេញលេញ ឬដំណោះស្រាយផ្សេងដែលព្រមព្រៀងជាមួយយើង។",
      ] },
      { title: "៧. ការទទួលខុសត្រូវ និងដែនកំណត់", paragraphs: [
        "យើងនឹងយកចិត្តទុកដាក់សមហេតុផលក្នុងការរៀបចំសេវា។ យើងមិនទទួលខុសត្រូវលើការយឺត ឬបរាជ័យដោយព្រឹត្តិការណ៍ក្រៅការគ្រប់គ្រងសមហេតុផល ដូចជាអាកាសធាតុធ្ងន់ធ្ងរ បិទផ្លូវ គ្រោះថ្នាក់ចរាចរណ៍ អាសន្នសាធារណៈ សកម្មភាពរដ្ឋ កូដកម្ម ឬព័ត៌មានមិនត្រឹមត្រូវពីអ្នកដំណើរ។",
        "លក្ខខណ្ឌនេះមិនដក ឬកំណត់ការទទួលខុសត្រូវដែលច្បាប់កម្ពុជាមិនអនុញ្ញាតឱ្យដកឡើយ រួមទាំងមរណភាព ឬរបួសដោយការធ្វេសប្រហែស ការឆបោក និងការការពារអ្នកប្រើប្រាស់ជាកាតព្វកិច្ច។ ក្រៅពីសិទ្ធិទាំងនោះ SAIWAY មិនទទួលខុសត្រូវលើការខាតបង់ប្រយោល ការខកខានដំណើរបន្ត ឬការខាតបង់ពីការមិនធ្វើតាមការណែនាំកក់។",
      ] },
      { title: "៨. ច្បាប់អនុវត្ត និងទំនាក់ទំនង", paragraphs: [
        "លក្ខខណ្ឌនេះអនុវត្តស្របតាមច្បាប់កម្ពុជា រួមមានច្បាប់ការពារអ្នកប្រើប្រាស់ (២០១៩) ច្បាប់ពាណិជ្ជកម្មតាមប្រព័ន្ធអេឡិចត្រូនិក (២០១៩) ច្បាប់ចរាចរណ៍ផ្លូវគោក (២០១៤) ក្រមរដ្ឋប្បវេណី និងតម្រូវការអាជ្ញាបណ្ណ ឬដឹកជញ្ជូនអ្នកដំណើរ។ បទប្បញ្ញត្តិជាកាតព្វកិច្ចមានអាទិភាពបើមានភាពផ្ទុយគ្នា។",
        "លក្ខខណ្ឌនេះស្ថិតក្រោមច្បាប់ព្រះរាជាណាចក្រកម្ពុជា។ យើងនឹងព្យាយាមដោះស្រាយបណ្តឹងដោយសុចរិតជាមុន។ បើមិនអាចដោះស្រាយ អាចដាក់ទៅតុលាការមានសមត្ថកិច្ចនៅកម្ពុជា ដោយគោរពសិទ្ធិអ្នកប្រើប្រាស់ជាកាតព្វកិច្ច។",
        "សម្រាប់សំណួរ ការកែប្រែ ឬបណ្តឹង សូមទាក់ទង SAIWAY តាមព័ត៌មានក្នុងការបញ្ជាក់កក់ និងផ្តល់លេខយោងកក់។",
      ] },
    ],
  },
  privacy: {
    title: "សេចក្តីជូនដំណឹងឯកជនភាព",
    notice: "ឯកសារនេះជាសេចក្តីព្រាងសម្រាប់សេវា SAIWAY នៅកម្ពុជា។ ត្រូវឱ្យអ្នកច្បាប់កម្ពុជាដែលមានសមត្ថភាពពិនិត្យមុនផ្សព្វផ្សាយ។ ត្រូវជំនួសព័ត៌មានបណ្តោះអាសន្នដោយនីតិបុគ្គល និងព័ត៌មានទំនាក់ទំនងចុងក្រោយ។",
    sections: [
      { title: "១. អ្នកទទួលខុសត្រូវព័ត៌មាន", body: "SAIWAY ទទួលខុសត្រូវលើព័ត៌មានផ្ទាល់ខ្លួនដែលប្រមូលតាមគេហទំព័រដើម្បីរៀបចំដំណើរ។ ត្រូវបញ្ចូលឈ្មោះប្រតិបត្តិករ អាសយដ្ឋានចុះបញ្ជី និងអ៊ីមែលចុងក្រោយមុនចាប់ផ្ដើម ដើម្បីឱ្យអតិថិជនទាក់ទងនីតិបុគ្គលកម្ពុជាត្រឹមត្រូវ។" },
      { title: "២. ព័ត៌មានដែលប្រមូល", body: "យើងអាចប្រមូលឈ្មោះ អ៊ីមែល ទូរស័ព្ទ លេខយោងកក់ ទីតាំងចេញ និងគោលដៅ លេខជើងហោះហើរ ចំនួនអ្នកដំណើរ តម្រូវការវ៉ាលី ឬភាពងាយស្រួល ស្ថានភាពទូទាត់ សារ និងព័ត៌មានចាំបាច់សម្រាប់ដំណើរ។ យើងក៏អាចទទួលទីតាំងយានយន្ត ឬស្ថានភាពដំណើរពីអ្នកបើកបរ ឬដៃគូពេលដំណើរសកម្ម។" },
      { title: "៣. ការប្រើប្រាស់ព័ត៌មាន", body: "យើងប្រើព័ត៌មានដើម្បីបង្កើត និងគ្រប់គ្រងការកក់ ផ្ញើការបញ្ជាក់ និងកែប្រែ សម្របសម្រួលអ្នកបើកបរ ផ្តល់ព័ត៌មានដំណើរផ្ទាល់ ដំណើរការទូទាត់ និងសងប្រាក់ ឆ្លើយសំណើជំនួយ បង្ការការឆបោក រក្សាកំណត់ត្រាអាជីវកម្ម និងគោរពកាតព្វកិច្ចច្បាប់ ពន្ធ គណនេយ្យ និងដឹកជញ្ជូនកម្ពុជា។ យើងមិនលក់ព័ត៌មានផ្ទាល់ខ្លួនអ្នកដំណើរ។" },
      { title: "៤. ការចែករំលែក", body: "យើងចែករំលែកតែព័ត៌មានចាំបាច់សមហេតុផលជាមួយអ្នកបើកបរ ឬដៃគូដែលបានចាត់តាំង អ្នកផ្តល់សេវាទូទាត់ និងបច្ចេកវិទ្យា សេវាជំនួយ ធានារ៉ាប់រង ឬទីប្រឹក្សា និងអាជ្ញាធរពេលច្បាប់ ឬសុវត្ថិភាពតម្រូវ។ អ្នកផ្តល់សេវាត្រូវប្រើព័ត៌មានសម្រាប់សេវាដែលព្រមព្រៀង និងការពារឱ្យបានសមស្រប។" },
      { title: "៥. ទីតាំង និងព័ត៌មានហោះហើរ", body: "បើអ្នកផ្តល់លេខជើងហោះហើរ យើងអាចប្រើដើម្បីប៉ាន់ស្មានការមកដល់ និងរៀបចំទទួល។ ពេលដំណើរសកម្ម ទីតាំងផ្ទាល់អាចបង្ហាញស្ថានភាពអ្នកបើកបរ និងគាំទ្រសុវត្ថិភាព និងការចាត់តាំង។ យើងមិនផ្តល់ការតាមដានបន្តក្រៅការកក់ពាក់ព័ន្ធ លើកលែងមានការយល់ព្រមដោយឡែក។" },
      { title: "៦. ការរក្សាទុក និងសុវត្ថិភាព", body: "យើងរក្សាកំណត់ត្រាកក់ និងប្រតិបត្តិការតាមរយៈពេលចាំបាច់សមហេតុផលសម្រាប់សេវា ជំនួយ គណនេយ្យ វិវាទ និងច្បាប់។ យើងប្រើវិធានការរដ្ឋបាល និងបច្ចេកទេសសមហេតុផល ប៉ុន្តែគ្មានប្រព័ន្ធបញ្ជូន ឬរក្សាទុកលើអ៊ីនធឺណិតណាអាចធានាសុវត្ថិភាពទាំងស្រុង។" },
      { title: "៧. ជម្រើស និងសំណើរបស់អ្នក", body: "អ្នកអាចទាក់ទងស្នើសុំចូលមើល កែតម្រូវ ឬលុបព័ត៌មានផ្ទាល់ខ្លួន ឬសួរអំពីការប្រើប្រាស់។ យើងអាចផ្ទៀងផ្ទាត់អត្តសញ្ញាណ និងរក្សាព័ត៌មានដែលចាំបាច់សម្រាប់ច្បាប់ សុវត្ថិភាព គណនេយ្យ ឬវិវាទ។ បើច្បាប់កម្ពុជាកំណត់ដែនសំណើ យើងនឹងពន្យល់។" },
      { title: "៨. ខូគី និងភាគីទីបី", body: "គេហទំព័រអាចប្រើខូគីចាំបាច់ ឬបច្ចេកវិទ្យាស្រដៀងសម្រាប់សុវត្ថិភាព វគ្គប្រើប្រាស់ និងដំណើរការមូលដ្ឋាន។ បើបន្ថែមការវិភាគ ការផ្សាយពាណិជ្ជកម្ម ឬបច្ចេកវិទ្យាមិនចាំបាច់ យើងនឹងផ្តល់សេចក្តីជូនដំណឹង និងជម្រើសសមស្រប។ តំណទៅអ្នកផ្តល់សេវាទូទាត់ ឬគេហទំព័រផ្សេងស្ថិតក្រោមសេចក្តីជូនដំណឹងឯកជនភាពរបស់ពួកគេ។" },
      { title: "៩. ទំនាក់ទំនង និងការកែប្រែ", body: "សូមទាក់ទង SAIWAY តាមព័ត៌មានក្នុងការបញ្ជាក់កក់សម្រាប់សំណួរ ឬសំណើឯកជនភាព។ យើងអាចកែប្រែសេចក្តីជូនដំណឹងពេលសេវា ដៃគូ ឬច្បាប់ផ្លាស់ប្តូរ។ កំណែចុងក្រោយនឹងផ្សព្វផ្សាយលើទំព័រនេះជាមួយកាលបរិច្ឆេទកែប្រែ។" },
    ],
  },
  cancellation: {
    title: "គោលការណ៍លុបចោល", when: "ពេលលុបចោល", refund: "ការសងប្រាក់",
    intro: "គោលការណ៍នេះអនុវត្តលើដំណើរឯកជន SAIWAY លើកលែងមានលក្ខខណ្ឌផ្សេងបង្ហាញច្បាស់ក្នុងការបញ្ជាក់កក់។ ត្រូវអានជាមួយច្បាប់ការពារអ្នកប្រើប្រាស់ (២០១៩) ច្បាប់ពាណិជ្ជកម្មតាមប្រព័ន្ធអេឡិចត្រូនិក (២០១៩) ច្បាប់ចរាចរណ៍ផ្លូវគោក (២០១៤) ក្រមរដ្ឋប្បវេណី និងតម្រូវការដឹកជញ្ជូនអ្នកដំណើរ។ សិទ្ធិលុបចោលជាកាតព្វកិច្ចតាមច្បាប់កម្ពុជាមិនផ្លាស់ប្តូរ។",
    notice: "ឯកសារនេះជាសេចក្តីព្រាងសម្រាប់អតិថិជន ហើយត្រូវឱ្យអ្នកច្បាប់កម្ពុជាដែលមានសមត្ថភាពពិនិត្យតាមអាជ្ញាបណ្ណ រចនាសម្ព័ន្ធប្រតិបត្តិករ លក្ខខណ្ឌទូទាត់ និងកាតព្វកិច្ចការពារអ្នកប្រើប្រាស់របស់ SAIWAY មុនចាប់ផ្ដើម។",
    rules: [
      { timing: "លើស ៤៨ ម៉ោងមុនចេញដំណើរ", result: "សងថ្លៃដំណើរពេញលេញ។" },
      { timing: "ពី ២៤ ទៅ ៤៨ ម៉ោងមុនចេញដំណើរ", result: "សង ៥០% នៃថ្លៃដំណើរ។" },
      { timing: "តិចជាង ២៤ ម៉ោងមុនចេញដំណើរ", result: "ជាធម្មតាថ្លៃដំណើរមិនអាចសងវិញ។" },
      { timing: "អ្នកដំណើរមិនមក", result: "មិនសងប្រាក់ក្រោយរយៈពេលរង់ចាំរួមបញ្ចូលបញ្ចប់។" },
    ],
    sections: [
      { title: "របៀបលុបចោល", paragraphs: ["ប្រើទំនាក់ទំនងលុបចោលក្នុងការបញ្ជាក់ និងផ្តល់លេខយោងកក់។ ពេលដែលយើងទទួលសំណើកំណត់រយៈពេលអនុវត្ត។ ការលុបចោលមិនទាន់បញ្ចប់ទាល់តែ SAIWAY បញ្ជាក់ទទួល។"] },
      { title: "ការកែប្រែ និងប្តូរពេល", paragraphs: ["ស្នើកែប្រែឱ្យបានឆាប់។ យើងនឹងព្យាយាមរៀបចំកាលបរិច្ឆេទ ពេល ផ្លូវ ឬចំនួនអ្នកដំណើរថ្មី អាស្រ័យលើភាពទំនេរ និងភាពខុសគ្នាតម្លៃ។ ការកែប្រែសំខាន់អាចចាត់ទុកជាលុបចោល និងកក់ថ្មី។"] },
      { title: "ជើងហោះហើរយឺត", paragraphs: ["ពេលមានលេខជើងហោះហើរ SAIWAY អាចតាមដានការមកដល់ និងព្យាយាមកែពេលទទួល។ ការយឺតយូរ ខកជើងហោះហើរ ឬការកែប្រែដែលរារាំងអ្នកបើកបរបំពេញដំណើរ អាចចាត់ទុកជាលុបចោល ឬមិនមក អាស្រ័យលើស្ថានភាព និងលក្ខខណ្ឌរង់ចាំក្នុងការបញ្ជាក់។"] },
      { title: "ពេល SAIWAY លុបចោល", paragraphs: ["បើ SAIWAY លុបចោលដំណើរដែលបានបញ្ជាក់ ហើយមិនអាចផ្តល់ជំនួសសមស្រប អ្នកអាចជ្រើសសងប្រាក់ពេញលេញដែលបានបង់សម្រាប់ដំណើរនោះ ឬដំណោះស្រាយផ្សេងដែលព្រមព្រៀង។ រយៈពេលសងអាស្រ័យលើអ្នកផ្តល់សេវាទូទាត់។"] },
      { title: "ស្ថានភាពពិសេស", paragraphs: ["យើងនឹងពិចារណាជម្រើសសមហេតុផលពេលដំណើររងផលប៉ះពាល់ពីអាកាសធាតុធ្ងន់ធ្ងរ បិទផ្លូវ អាសន្នសាធារណៈ ការរឹតត្បិតរដ្ឋ ឬព្រឹត្តិការណ៍ក្រៅការគ្រប់គ្រង។ គោលការណ៍នេះមិនដកសិទ្ធិដែលច្បាប់កម្ពុជាមិនអនុញ្ញាតឱ្យដកឡើយ។"] },
    ],
  },
};
export const legalCopy = { fr, km };
