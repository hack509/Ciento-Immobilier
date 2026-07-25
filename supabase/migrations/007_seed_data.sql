-- =====================================================
-- Ciento-Immobilier: Seed Data
-- =====================================================
-- Initial data for the Haitian real estate market

-- =====================================================
-- 1. CITIES
-- =====================================================
INSERT INTO cities (id, name, slug, department, latitude, longitude) VALUES
  ('a1b2c3d4-0001-0000-0000-000000000001', 'Les Gonaïves', 'les-gonaives', 'Artibonite', 19.4444, -72.6847),
  ('a1b2c3d4-0002-0000-0000-000000000002', 'Port-au-Prince', 'port-au-prince', 'Ouest', 18.5944, -72.3078),
  ('a1b2c3d4-0003-0000-0000-000000000003', 'Cap-Haïtien', 'cap-haitien', 'Nord', 19.7578, -72.2044),
  ('a1b2c3d4-0004-0000-0000-000000000004', 'Jacmel', 'jacmel', 'Sud-Est', 18.2344, -72.5303),
  ('a1b2c3d4-0005-0000-0000-000000000005', 'Jérémie', 'jeremie', 'Grand''Anse', 18.6500, -74.1167),
  ('a1b2c3d4-0006-0000-0000-000000000006', 'Les Cayes', 'les-cayes', 'Sud', 18.2000, -73.7500),
  ('a1b2c3d4-0007-0000-0000-000000000007', 'Saint-Marc', 'saint-marc', 'Artibonite', 19.1083, -72.6961),
  ('a1b2c3d4-0008-0000-0000-000000000008', 'Verrettes', 'verrettes', 'Artibonite', 19.0500, -72.4667),
  ('a1b2c3d4-0009-0000-0000-000000000009', 'Milot', 'milot', 'Nord', 19.6083, -72.2167),
  ('a1b2c3d4-0010-0000-0000-000000000010', 'Hinche', 'hinche', 'Centre', 19.1500, -72.0167);

-- =====================================================
-- 2. NEIGHBORHOODS (Gonaïves focus)
-- =====================================================
INSERT INTO neighborhoods (city_id, name, slug) VALUES
  -- Les Gonaïves
  ('a1b2c3d4-0001-0000-0000-000000000001', 'Centre-ville', 'centre-ville'),
  ('a1b2c3d4-0001-0000-0000-000000000001', 'Bellevue', 'bellevue'),
  ('a1b2c3d4-0001-0000-0000-000000000001', 'Chemin de Fer', 'chemin-de-fer'),
  ('a1b2c3d4-0001-0000-0000-000000000001', 'La Boulée', 'la-boulee'),
  ('a1b2c3d4-0001-0000-0000-000000000001', 'Tavernier', 'tavernier'),
  ('a1b2c3d4-0001-0000-0000-000000000001', 'Rivière Grâce', 'riviere-grace'),
  ('a1b2c3d4-0001-0000-0000-000000000001', 'Pélerin', 'pelerin'),
  ('a1b2c3d4-0001-0000-0000-000000000001', 'Carrefour Feuilles', 'carrefour-feuilles'),
  ('a1b2c3d4-0001-0000-0000-000000000001', 'Morne Boyer', 'morne-boyer'),
  ('a1b2c3d4-0001-0000-0000-000000000001', 'Deslandes', 'deslandes'),
  ('a1b2c3d4-0001-0000-0000-000000000001', 'Plaisance', 'plaisance'),
  ('a1b2c3d4-0001-0000-0000-000000000001', 'Bassin Bleu', 'bassin-bleu'),
  -- Port-au-Prince
  ('a1b2c3d4-0002-0000-0000-000000000002', 'Pétion-Ville', 'petion-ville'),
  ('a1b2c3d4-0002-0000-0000-000000000002', 'Delmas', 'delmas'),
  ('a1b2c3d4-0002-0000-0000-000000000002', 'Tabarre', 'tabarre'),
  ('a1b2c3d4-0002-0000-0000-000000000002', 'Carrefour', 'carrefour'),
  ('a1b2c3d4-0002-0000-0000-000000000002', 'Morne l''Hôpital', 'morne-hopital'),
  ('a1b2c3d4-0002-0000-0000-000000000002', 'Turgeau', 'turgeau'),
  -- Cap-Haïtien
  ('a1b2c3d4-0003-0000-0000-000000000003', 'Centre-ville', 'centre-ville'),
  ('a1b2c3d4-0003-0000-0000-000000000003', 'Acul Samedi', 'acul-samedi'),
  ('a1b2c3d4-0003-0000-0000-000000000003', 'Haut du Cap', 'haut-du-cap'),
  ('a1b2c3d4-0003-0000-0000-000000000003', 'Caracol', 'caracol');

-- =====================================================
-- 3. CATEGORIES
-- =====================================================
INSERT INTO categories (name, slug, description, icon, sort_order) VALUES
  ('Maison', 'maison', 'Maisons familiales et unifamiliales', 'Home', 1),
  ('Appartement', 'appartement', 'Appartements et unités résidentielles', 'Building2', 2),
  ('Terrain', 'terrain', 'Terrains nus et terrains constructibles', 'Mountain', 3),
  ('Local Commercial', 'local-commercial', 'Locaux commerciaux et bureaux', 'Store', 4),
  ('Immeuble', 'immeuble', 'Immeubles et immeubles locatifs', 'Building', 5),
  ('Villa', 'villa', 'Villas de luxe et résidences', 'Castle', 6);

-- =====================================================
-- 4. AMENITIES
-- =====================================================
INSERT INTO amenities (name, slug, icon, category) VALUES
  -- Infrastructure
  ('Eau courante', 'eau-courante', 'Droplet', 'infrastructure'),
  ('Électricité', 'electricite', 'Zap', 'infrastructure'),
  ('Groupe électrogène', 'groupe-electrogene', 'Battery', 'infrastructure'),
  ('Panneaux solaires', 'panneaux-solaires', 'Sun', 'infrastructure'),
  ('Téléphone fixe', 'telephone-fixe', 'Phone', 'infrastructure'),
  ('Internet', 'internet', 'Wifi', 'infrastructure'),
  ('Câble TV', 'cable-tv', 'Tv', 'infrastructure'),
  -- Sécurité
  ('Gardien', 'gardien', 'Shield', 'securite'),
  ('Caméras de surveillance', 'cameras', 'Camera', 'securite'),
  ('Portail électrique', 'portail-electrique', 'Lock', 'securite'),
  ('Mur d''enceinte', 'mur-enceinte', 'ShieldCheck', 'securite'),
  -- Confort
  ('Climatisation', 'climatisation', 'Snowflake', 'confort'),
  ('Ventilateur', 'ventilateur', 'Fan', 'confort'),
  ('Eau chaude', 'eau-chaude', 'Flame', 'confort'),
  ('Buanderie', 'buanderie', 'Shirt', 'confort'),
  ('Meublé', 'meuble', 'Armchair', 'confort'),
  ('Cuisine aménagée', 'cuisine-amenagee', 'ChefHat', 'confort'),
  ('Plafond décoratif', 'plafond-decoratif', 'Layers', 'confort'),
  ('Carrelage', 'carrelage', 'Grid3x3', 'confort'),
  ('Jardin', 'jardin', 'TreePine', 'confort'),
  ('Piscine', 'piscine', 'Waves', 'confort'),
  ('Garage', 'garage', 'Car', 'confort'),
  ('Terrasse', 'terrasse', 'Sun', 'confort'),
  ('Balcon', 'balcon', 'Layout', 'confort'),
  ('Vue panoramique', 'vue-panoramique', 'Eye', 'confort'),
  ('Cheminée', 'cheminee', 'Flame', 'confort'),
  -- Extérieur
  ('Parking', 'parking', 'ParkingSquare', 'exterieur'),
  ('Jardin paysager', 'jardin-paysager', 'Flower2', 'exterieur'),
  ('Patio', 'patio', 'Sun', 'exterieur'),
  ('Cour arrière', 'cour-arriere', 'Fence', 'exterieur');

-- =====================================================
-- 5. SITE SETTINGS (defaults)
-- =====================================================
INSERT INTO site_settings (key, value, description) VALUES
  ('site_name', '"Ciento-Immobilier"', 'Nom du site'),
  ('site_description', '"La première plateforme immobilière des Gonaïves, Haïti"', 'Description du site'),
  ('contact_email', '"info@ciento-immobilier.com"', 'Email de contact'),
  ('contact_phone', '"+509 2222-3333"', 'Téléphone de contact'),
  ('contact_whatsapp', '"+509 3333-4444"', 'WhatsApp de contact'),
  ('contact_address', '"Les Gonaïves, Artibonite, Haïti"', 'Adresse de contact'),
  ('currency', '"HTG"', 'Devise par défaut'),
  ('items_per_page', '12', 'Éléments par page'),
  ('max_images_per_property', '20', 'Nombre max d''images par annonce'),
  ('max_upload_size_mb', '5', 'Taille max upload en MB'),
  ('maintenance_mode', 'false', 'Mode maintenance'),
  ('registration_enabled', 'true', 'Inscriptions activées'),
  ('google_maps_api_key', '""', 'Clé API Google Maps');
