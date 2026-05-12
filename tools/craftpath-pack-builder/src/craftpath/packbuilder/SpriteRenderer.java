package craftpath.packbuilder;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.geom.AffineTransform;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;

public final class SpriteRenderer {
    private SpriteRenderer() {}

    public static void copyItemTexture(Path texture, Path output) throws IOException {
        Files.createDirectories(output.getParent());
        BufferedImage image = ImageIO.read(texture.toFile());
        if (image == null) return;
        ImageIO.write(scaleNearest(image, 32, 32), "png", output.toFile());
    }

    public static void renderBlockTexture(Path texture, Path output) throws IOException {
        renderBlockTextures(texture, texture, texture, output);
    }

    public static void renderBlockTextures(Path topTexture, Path leftTexture, Path rightTexture, Path output) throws IOException {
        Files.createDirectories(output.getParent());
        BufferedImage top = readTexture(topTexture);
        BufferedImage left = readTexture(leftTexture);
        BufferedImage right = readTexture(rightTexture);
        if (top == null && left == null && right == null) return;
        if (top == null) top = left != null ? left : right;
        if (left == null) left = top;
        if (right == null) right = left;

        BufferedImage canvas = new BufferedImage(32, 32, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = canvas.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_NEAREST_NEIGHBOR);

        drawFace(g, tint(top, 1.10f), new double[] {16, 1, 31, 8, 16, 15, 1, 8});
        drawFace(g, tint(left, 0.82f), new double[] {1, 8, 16, 15, 16, 31, 1, 24});
        drawFace(g, tint(right, 0.68f), new double[] {31, 8, 16, 15, 16, 31, 31, 24});
        g.dispose();
        ImageIO.write(canvas, "png", output.toFile());
    }

    public static void renderCuboids(List<Cuboid> cuboids, Path output) throws IOException {
        Files.createDirectories(output.getParent());
        if (cuboids == null || cuboids.isEmpty()) return;

        BufferedImage canvas = new BufferedImage(32, 32, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = canvas.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_NEAREST_NEIGHBOR);

        cuboids.stream()
                .sorted(Comparator.comparingDouble((Cuboid c) -> c.from[0] + c.from[2] + c.from[1]))
                .forEach(cuboid -> drawCuboid(g, cuboid));

        g.dispose();
        ImageIO.write(canvas, "png", output.toFile());
    }

    private static void drawCuboid(Graphics2D g, Cuboid cuboid) {
        try {
            BufferedImage top = readTexture(cuboid.top);
            BufferedImage left = readTexture(cuboid.left);
            BufferedImage right = readTexture(cuboid.right);
            if (top == null && left == null && right == null) return;
            if (top == null) top = left != null ? left : right;
            if (left == null) left = top;
            if (right == null) right = left;

            double x1 = cuboid.from[0];
            double y1 = cuboid.from[1];
            double z1 = cuboid.from[2];
            double x2 = cuboid.to[0];
            double y2 = cuboid.to[1];
            double z2 = cuboid.to[2];

            drawFace(g, tint(left, 0.82f), project(new double[][] {
                    {x1, y1, z1}, {x1, y1, z2}, {x1, y2, z2}, {x1, y2, z1}
            }));
            drawFace(g, tint(right, 0.68f), project(new double[][] {
                    {x1, y1, z2}, {x2, y1, z2}, {x2, y2, z2}, {x1, y2, z2}
            }));
            drawFace(g, tint(top, 1.10f), project(new double[][] {
                    {x1, y2, z1}, {x2, y2, z1}, {x2, y2, z2}, {x1, y2, z2}
            }));
        } catch (IOException ignored) {
            // A missing texture should skip only this cuboid, not the entire pack.
        }
    }

    private static double[] project(double[][] points) {
        double[] out = new double[points.length * 2];
        for (int i = 0; i < points.length; i++) {
            double x = points[i][0] - 8;
            double y = points[i][1];
            double z = points[i][2] - 8;
            out[i * 2] = 16 + (x - z) * 0.78;
            out[i * 2 + 1] = 19 + (x + z) * 0.38 - y * 0.72;
        }
        return out;
    }

    private static BufferedImage readTexture(Path texture) throws IOException {
        if (texture == null || !Files.exists(texture)) return null;
        BufferedImage image = ImageIO.read(texture.toFile());
        return image == null ? null : scaleNearest(image, 32, 32);
    }

    private static BufferedImage scaleNearest(BufferedImage source, int width, int height) {
        BufferedImage scaled = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = scaled.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_NEAREST_NEIGHBOR);
        g.drawImage(source, 0, 0, width, height, null);
        g.dispose();
        return scaled;
    }

    private static BufferedImage tint(BufferedImage source, float factor) {
        BufferedImage tinted = new BufferedImage(source.getWidth(), source.getHeight(), BufferedImage.TYPE_INT_ARGB);
        for (int y = 0; y < source.getHeight(); y++) {
            for (int x = 0; x < source.getWidth(); x++) {
                int argb = source.getRGB(x, y);
                int a = (argb >>> 24) & 0xff;
                int r = Math.min(255, Math.round(((argb >>> 16) & 0xff) * factor));
                int g = Math.min(255, Math.round(((argb >>> 8) & 0xff) * factor));
                int b = Math.min(255, Math.round((argb & 0xff) * factor));
                tinted.setRGB(x, y, (a << 24) | (r << 16) | (g << 8) | b);
            }
        }
        return tinted;
    }

    private static void drawFace(Graphics2D g, BufferedImage texture, double[] dst) {
        Polygon clip = toPolygon(dst);
        Shape oldClip = g.getClip();
        g.setClip(clip);
        Rectangle bounds = clip.getBounds();
        AffineTransform transform = new AffineTransform();
        transform.translate(bounds.x, bounds.y);
        transform.scale(bounds.getWidth() / texture.getWidth(), bounds.getHeight() / texture.getHeight());
        g.drawImage(texture, transform, null);
        g.setClip(oldClip);
    }

    private static Polygon toPolygon(double[] points) {
        Polygon polygon = new Polygon();
        for (int i = 0; i < points.length; i += 2) {
            polygon.addPoint((int) Math.round(points[i]), (int) Math.round(points[i + 1]));
        }
        return polygon;
    }

    public static final class Cuboid {
        public final double[] from;
        public final double[] to;
        public final Path top;
        public final Path left;
        public final Path right;

        public Cuboid(double[] from, double[] to, Path top, Path left, Path right) {
            this.from = from;
            this.to = to;
            this.top = top;
            this.left = left;
            this.right = right;
        }
    }
}
