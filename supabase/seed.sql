-- Datos iniciales del tablero Gantt MATERAN (exportado 2026-10-01).
-- Generado por scripts/generate-seed.mjs. Ejecutar después de las migraciones; si ya hay actividades, no inserta nada.

insert into public.frentes (nombre, color, orden) values
  ('Estrategia', '#2709CD', 1),
  ('Digital / RRSS', '#0094FF', 2),
  ('E-commerce', '#00D9FF', 3),
  ('Producto', '#1DCE00', 4),
  ('Packaging', '#516276', 5),
  ('Legal', '#86858A', 6)
on conflict (nombre) do nothing;

insert into public.responsables (nombre) values
  ('Luis Cuellar'),
  ('Alejandro Marín - Analista MKT'),
  ('Natalia Ochoa - CM'),
  ('Dirección de Marca'),
  ('Estefanny Botache y David Cadena'),
  ('Valeria Barrera - D. Ux Ui'),
  ('Luis Cuellar y legal'),
  ('Cristian Sabogal - DEV'),
  ('Daniel Salinas'),
  ('Fábrica CI Trading'),
  ('Coordinación de Producto'),
  ('Audiovisual'),
  ('Estefanny Botache - D. Grafica'),
  ('Luiseth'),
  ('MQS SAS'),
  ('Luiseth / Diseño G.'),
  ('Legal')
on conflict (nombre) do nothing;

insert into public.tasks (num, frente_id, responsable_id, actividad, estado, avance, inicio, fin, notas)
select v.num, f.id, r.id, v.actividad, v.estado, v.avance, v.inicio::date, v.fin::date, v.notas
from (values
  (1, 'Estrategia', 'Luis Cuellar', 'Benchmark de competencia', 'Cerrada', 100, '2026-07-27', '2026-07-30', ''),
  (2, 'Estrategia', 'Alejandro Marín - Analista MKT', 'Estrategia de lanzamiento', 'Cerrada', 100, '2026-08-10', '2026-08-14', ''),
  (3, 'Estrategia', 'Natalia Ochoa - CM', 'Estrategia de relacionamiento y PR', 'Cerrada', 100, '2026-08-10', '2026-08-14', ''),
  (4, 'Estrategia', 'Dirección de Marca', 'Definición de la fecha de lanzamiento', 'Pendiente', 0, '2026-08-31', '2026-08-31', ''),
  (5, 'Digital / RRSS', 'Natalia Ochoa - CM', 'Creación de las cuentas de RRSS', 'Cerrada', 100, '2026-07-27', '2026-07-31', ''),
  (6, 'Digital / RRSS', 'Natalia Ochoa - CM', 'Parrilla de contenido — expectativa', 'En curso', 20, '2026-08-18', '2026-08-21', ''),
  (7, 'Digital / RRSS', 'Natalia Ochoa - CM', 'Parrilla de contenido — lanzamiento', 'En curso', 20, '2026-08-18', '2026-08-21', ''),
  (8, 'Digital / RRSS', 'Estefanny Botache y David Cadena', 'Producción de piezas gráficas y audiovisuales', 'Pendiente', 0, '2026-08-24', '2026-08-28', ''),
  (9, 'Digital / RRSS', 'Natalia Ochoa - CM', 'Publicación de la fase de expectativa', 'Pendiente', 0, '2026-09-01', '2026-09-30', ''),
  (10, 'Digital / RRSS', 'Natalia Ochoa - CM', 'Lanzamiento de marca en RRSS', 'Pendiente', 0, '2026-11-01', '2026-11-30', ''),
  (11, 'E-commerce', 'Valeria Barrera - D. Ux Ui', 'Primera propuesta de UX/UI', 'Cerrada', 100, '2026-07-01', '2026-07-15', ''),
  (12, 'E-commerce', 'Valeria Barrera - D. Ux Ui', 'Ajustes y aprobación de UX/UI', 'En curso', 10, '2026-08-11', '2026-08-31', ''),
  (13, 'E-commerce', 'Luis Cuellar', 'Apertura de la cuenta Shopify', 'Cerrada', 100, '2026-06-01', '2026-06-03', ''),
  (14, 'E-commerce', 'Luis Cuellar', 'Configuración de la pasarela de pago', 'Pendiente', 0, '2026-09-01', '2026-09-04', ''),
  (15, 'E-commerce', 'Luis Cuellar y legal', 'Configuración de facturación electrónica', 'Pendiente', 0, '2026-09-01', '2026-09-04', ''),
  (16, 'E-commerce', 'Cristian Sabogal - DEV', 'Maquetación y desarrollo del sitio', 'Pendiente', 0, '2026-09-01', '2026-09-10', ''),
  (17, 'E-commerce', 'Cristian Sabogal - DEV', 'Carga de catálogo y fichas de producto', 'Pendiente', 0, '2026-09-11', '2026-09-11', ''),
  (18, 'E-commerce', 'Cristian Sabogal - DEV', 'Pruebas y salida a producción', 'Pendiente', 0, '2026-11-01', '2026-11-01', ''),
  (19, 'Producto', 'Daniel Salinas', 'Pago de las prendas al proveedor', 'Pendiente', 0, '2026-08-11', '2026-08-14', ''),
  (20, 'Producto', 'Fábrica CI Trading', 'Producción y entrega de las prendas', 'Pendiente', 0, '2026-08-18', '2026-09-30', ''),
  (21, 'Producto', 'Coordinación de Producto', 'Recepción y control de calidad', 'Pendiente', 0, '2026-10-08', '2026-10-10', ''),
  (22, 'Producto', 'Audiovisual', 'Sesión de fotos de producto', 'Pendiente', 0, '2026-10-12', '2026-10-12', ''),
  (23, 'Packaging', 'Estefanny Botache - D. Grafica', 'Diseño de la PR Box', 'Cerrada', 100, '2026-07-01', '2026-07-07', ''),
  (24, 'Packaging', 'Estefanny Botache - D. Grafica', 'Diseño de la bolsa de papel', 'Cerrada', 100, '2026-07-01', '2026-07-07', ''),
  (25, 'Packaging', 'Estefanny Botache - D. Grafica', 'Diseño de la bolsa de tela', 'Cerrada', 100, '2026-07-01', '2026-07-07', ''),
  (26, 'Packaging', 'Estefanny Botache - D. Grafica', 'Diseño de las marquillas tejidas', 'Cerrada', 100, '2026-07-01', '2026-07-07', ''),
  (27, 'Packaging', 'Estefanny Botache - D. Grafica', 'Diseño de las etiquetas de cartón', 'Cerrada', 100, '2026-07-01', '2026-07-07', ''),
  (28, 'Packaging', 'Estefanny Botache - D. Grafica', 'Diseño del certificado de autenticidad', 'Cerrada', 100, '2026-07-01', '2026-07-07', ''),
  (29, 'Packaging', 'Luiseth', 'Aprobación de las marquillas tejidas', 'Cerrada', 100, '2026-08-10', '2026-08-10', ''),
  (30, 'Packaging', 'MQS SAS', 'Producción de las marquillas tejidas', 'Pendiente', 0, '2026-08-18', '2026-09-08', ''),
  (31, 'Packaging', 'Luiseth / Diseño G.', 'Aprobación y ajustes — PR Box', 'En curso', 0, '2026-08-10', '2026-08-21', ''),
  (32, 'Packaging', 'Luiseth / Diseño G.', 'Aprobación y ajustes — bolsa de papel', 'Cerrada', 100, '2026-08-03', '2026-08-11', ''),
  (33, 'Packaging', 'Luiseth / Diseño G.', 'Aprobación y ajustes — bolsa de tela', 'Cerrada', 100, '2026-08-03', '2026-08-11', ''),
  (34, 'Packaging', 'Luiseth / Diseño G.', 'Aprobación y ajustes — etiquetas de cartón', 'En curso', 50, '2026-08-10', '2026-08-12', ''),
  (35, 'Packaging', 'Luiseth / Diseño G.', 'Aprobación y ajustes — certificado de autenticidad', 'En curso', 50, '2026-08-10', '2026-08-12', ''),
  (36, 'Packaging', 'MQS SAS', 'Producción del packaging restante', 'Pendiente', 0, '2026-08-18', '2026-09-08', ''),
  (37, 'Packaging', 'Luis Cuellar', 'Cotizaciones', 'Cerrada', 100, '2026-07-20', '2026-08-07', ''),
  (38, 'Legal', 'Legal', 'T&C de cambios, garantías y devoluciones', 'Pendiente', 0, '2026-08-13', '2026-08-19', '')
) as v(num, frente, responsable, actividad, estado, avance, inicio, fin, notas)
join public.frentes f on f.nombre = v.frente
left join public.responsables r on r.nombre = v.responsable
where not exists (select 1 from public.tasks);
