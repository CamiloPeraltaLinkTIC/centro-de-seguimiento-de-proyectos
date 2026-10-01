-- Datos iniciales exportados del tablero Gantt MATERAN (corte 2026-10-01).
-- Ejecutar una sola vez, después de 0001_schema.sql.

insert into public.frentes (nombre, color, orden) values
  ('Estrategia', '#2709CD', 1),
  ('Digital / RRSS', '#0094FF', 2),
  ('E-commerce', '#00D9FF', 3),
  ('Producto', '#1DCE00', 4),
  ('Packaging', '#516276', 5),
  ('Legal', '#86858A', 6)
on conflict (nombre) do nothing;

insert into public.tasks (num, frente_id, actividad, responsable, estado, avance, inicio, fin, notas)
select v.num, f.id, v.actividad, v.responsable, v.estado, v.avance, v.inicio::date, v.fin::date, v.notas
from (values
  (1, 'Estrategia', 'Benchmark de competencia', 'Luis Cuellar', 'Cerrada', 100, '2026-07-27', '2026-07-30', ''),
  (2, 'Estrategia', 'Estrategia de lanzamiento', 'Alejandro Marín - Analista MKT', 'Cerrada', 100, '2026-08-10', '2026-08-14', ''),
  (3, 'Estrategia', 'Estrategia de relacionamiento y PR', 'Natalia Ochoa - CM', 'Cerrada', 100, '2026-08-10', '2026-08-14', ''),
  (4, 'Estrategia', 'Definición de la fecha de lanzamiento', 'Dirección de Marca', 'Pendiente', 0, '2026-08-31', '2026-08-31', ''),
  (5, 'Digital / RRSS', 'Creación de las cuentas de RRSS', 'Natalia Ochoa - CM', 'Cerrada', 100, '2026-07-27', '2026-07-31', ''),
  (6, 'Digital / RRSS', 'Parrilla de contenido — expectativa', 'Natalia Ochoa - CM', 'En curso', 20, '2026-08-18', '2026-08-21', ''),
  (7, 'Digital / RRSS', 'Parrilla de contenido — lanzamiento', 'Natalia Ochoa - CM', 'En curso', 20, '2026-08-18', '2026-08-21', ''),
  (8, 'Digital / RRSS', 'Producción de piezas gráficas y audiovisuales', 'Estefanny Botache y David Cadena', 'Pendiente', 0, '2026-08-24', '2026-08-28', ''),
  (9, 'Digital / RRSS', 'Publicación de la fase de expectativa', 'Natalia Ochoa - CM', 'Pendiente', 0, '2026-09-01', '2026-09-30', ''),
  (10, 'Digital / RRSS', 'Lanzamiento de marca en RRSS', 'Natalia Ochoa - CM', 'Pendiente', 0, '2026-11-01', '2026-11-30', ''),
  (11, 'E-commerce', 'Primera propuesta de UX/UI', 'Valeria Barrera - D. Ux Ui', 'Cerrada', 100, '2026-07-01', '2026-07-15', ''),
  (12, 'E-commerce', 'Ajustes y aprobación de UX/UI', 'Valeria Barrera - D. Ux Ui', 'En curso', 10, '2026-08-11', '2026-08-31', ''),
  (13, 'E-commerce', 'Apertura de la cuenta Shopify', 'Luis Cuellar', 'Cerrada', 100, '2026-06-01', '2026-06-03', ''),
  (14, 'E-commerce', 'Configuración de la pasarela de pago', 'Luis Cuellar', 'Pendiente', 0, '2026-09-01', '2026-09-04', ''),
  (15, 'E-commerce', 'Configuración de facturación electrónica', 'Luis Cuellar y legal', 'Pendiente', 0, '2026-09-01', '2026-09-04', ''),
  (16, 'E-commerce', 'Maquetación y desarrollo del sitio', 'Cristian Sabogal - DEV', 'Pendiente', 0, '2026-09-01', '2026-09-10', ''),
  (17, 'E-commerce', 'Carga de catálogo y fichas de producto', 'Cristian Sabogal - DEV', 'Pendiente', 0, '2026-09-11', '2026-09-11', ''),
  (18, 'E-commerce', 'Pruebas y salida a producción', 'Cristian Sabogal - DEV', 'Pendiente', 0, '2026-11-01', '2026-11-01', ''),
  (19, 'Producto', 'Pago de las prendas al proveedor', 'Daniel Salinas', 'Pendiente', 0, '2026-08-11', '2026-08-14', ''),
  (20, 'Producto', 'Producción y entrega de las prendas', 'Fábrica CI Trading', 'Pendiente', 0, '2026-08-18', '2026-09-30', ''),
  (21, 'Producto', 'Recepción y control de calidad', 'Coordinación de Producto', 'Pendiente', 0, '2026-10-08', '2026-10-10', ''),
  (22, 'Producto', 'Sesión de fotos de producto', 'Audiovisual', 'Pendiente', 0, '2026-10-12', '2026-10-12', ''),
  (23, 'Packaging', 'Diseño de la PR Box', 'Estefanny Botache - D. Grafica', 'Cerrada', 100, '2026-07-01', '2026-07-07', ''),
  (24, 'Packaging', 'Diseño de la bolsa de papel', 'Estefanny Botache - D. Grafica', 'Cerrada', 100, '2026-07-01', '2026-07-07', ''),
  (25, 'Packaging', 'Diseño de la bolsa de tela', 'Estefanny Botache - D. Grafica', 'Cerrada', 100, '2026-07-01', '2026-07-07', ''),
  (26, 'Packaging', 'Diseño de las marquillas tejidas', 'Estefanny Botache - D. Grafica', 'Cerrada', 100, '2026-07-01', '2026-07-07', ''),
  (27, 'Packaging', 'Diseño de las etiquetas de cartón', 'Estefanny Botache - D. Grafica', 'Cerrada', 100, '2026-07-01', '2026-07-07', ''),
  (28, 'Packaging', 'Diseño del certificado de autenticidad', 'Estefanny Botache - D. Grafica', 'Cerrada', 100, '2026-07-01', '2026-07-07', ''),
  (29, 'Packaging', 'Aprobación de las marquillas tejidas', 'Luiseth', 'Cerrada', 100, '2026-08-10', '2026-08-10', ''),
  (30, 'Packaging', 'Producción de las marquillas tejidas', 'MQS SAS', 'Pendiente', 0, '2026-08-18', '2026-09-08', ''),
  (31, 'Packaging', 'Aprobación y ajustes — PR Box', 'Luiseth / Diseño G.', 'En curso', 0, '2026-08-10', '2026-08-21', ''),
  (32, 'Packaging', 'Aprobación y ajustes — bolsa de papel', 'Luiseth / Diseño G.', 'Cerrada', 100, '2026-08-03', '2026-08-11', ''),
  (33, 'Packaging', 'Aprobación y ajustes — bolsa de tela', 'Luiseth / Diseño G.', 'Cerrada', 100, '2026-08-03', '2026-08-11', ''),
  (34, 'Packaging', 'Aprobación y ajustes — etiquetas de cartón', 'Luiseth / Diseño G.', 'En curso', 50, '2026-08-10', '2026-08-12', ''),
  (35, 'Packaging', 'Aprobación y ajustes — certificado de autenticidad', 'Luiseth / Diseño G.', 'En curso', 50, '2026-08-10', '2026-08-12', ''),
  (36, 'Packaging', 'Producción del packaging restante', 'MQS SAS', 'Pendiente', 0, '2026-08-18', '2026-09-08', ''),
  (37, 'Packaging', 'Cotizaciones', 'Luis Cuellar', 'Cerrada', 100, '2026-07-20', '2026-08-07', ''),
  (38, 'Legal', 'T&C de cambios, garantías y devoluciones', 'Legal', 'Pendiente', 0, '2026-08-13', '2026-08-19', '')
) as v(num, frente, actividad, responsable, estado, avance, inicio, fin, notas)
join public.frentes f on f.nombre = v.frente
where not exists (select 1 from public.tasks);
