package craftpath.packbuilder;

import javax.swing.*;
import java.awt.*;
import java.io.File;
import java.nio.file.Path;

public class Main {
    public static void main(String[] args) {
        if (args.length >= 2) {
            Path source = Path.of(args[0]);
            Path output = Path.of(args[1]);
            String name = args.length >= 3 ? args[2] : source.getFileName().toString();
            Path fields = null;
            Path icons = null;
            if (args.length >= 4) {
                Path fourth = Path.of(args[3]);
                if (fourth.toFile().isDirectory()) icons = fourth;
                else fields = fourth;
            }
            if (args.length >= 5) icons = Path.of(args[4]);
            try {
                PackBuilder.BuildStats stats = new PackBuilder(source, output, name, fields, icons).build();
                System.out.println(stats);
            } catch (Exception ex) {
                ex.printStackTrace();
                System.exit(1);
            }
            return;
        }

        SwingUtilities.invokeLater(Main::showWindow);
    }

    private static void showWindow() {
        JFrame frame = new JFrame("CraftCodex Pack Builder");
        frame.setDefaultCloseOperation(WindowConstants.EXIT_ON_CLOSE);
        frame.setSize(720, 360);
        frame.setLocationRelativeTo(null);

        JTextField sourceField = new JTextField();
        JTextField outputField = new JTextField();
        JTextField nameField = new JTextField("Minecraft 26.1.2");
        JTextField fieldsField = new JTextField();
        JTextField iconsField = new JTextField();
        JTextArea log = new JTextArea();
        log.setEditable(false);

        JPanel form = new JPanel(new GridBagLayout());
        GridBagConstraints c = new GridBagConstraints();
        c.insets = new Insets(6, 8, 6, 8);
        c.fill = GridBagConstraints.HORIZONTAL;
        c.weightx = 1;

        addRow(form, c, 0, "Version folder", sourceField, () -> chooseDirectory(frame, sourceField));
        addRow(form, c, 1, "Output folder", outputField, () -> chooseDirectory(frame, outputField));
        addRow(form, c, 2, "Pack name", nameField, null);
        addRow(form, c, 3, "Optional item fields JSON", fieldsField, () -> chooseFile(frame, fieldsField));
        addRow(form, c, 4, "Optional IconExporter folder", iconsField, () -> chooseDirectory(frame, iconsField));

        JButton buildButton = new JButton("Build CraftCodex Pack");
        buildButton.addActionListener(event -> {
            buildButton.setEnabled(false);
            log.setText("Building...\n");
            new Thread(() -> {
                try {
                    Path fields = fieldsField.getText().isBlank() ? null : Path.of(fieldsField.getText());
                    Path icons = iconsField.getText().isBlank() ? null : Path.of(iconsField.getText());
                    PackBuilder.BuildStats stats = new PackBuilder(
                            Path.of(sourceField.getText()),
                            Path.of(outputField.getText()),
                            nameField.getText().isBlank() ? "Minecraft Pack" : nameField.getText(),
                            fields,
                            icons
                    ).build();
                    SwingUtilities.invokeLater(() -> log.setText(stats + "\nDone."));
                } catch (Exception ex) {
                    SwingUtilities.invokeLater(() -> log.setText("Build failed:\n" + ex));
                } finally {
                    SwingUtilities.invokeLater(() -> buildButton.setEnabled(true));
                }
            }).start();
        });

        JPanel root = new JPanel(new BorderLayout(10, 10));
        root.setBorder(BorderFactory.createEmptyBorder(12, 12, 12, 12));
        root.add(form, BorderLayout.NORTH);
        root.add(new JScrollPane(log), BorderLayout.CENTER);
        root.add(buildButton, BorderLayout.SOUTH);
        frame.setContentPane(root);
        frame.setVisible(true);
    }

    private static void addRow(JPanel form, GridBagConstraints c, int row, String label, JTextField field, Runnable browse) {
        c.gridy = row;
        c.gridx = 0;
        c.weightx = 0;
        form.add(new JLabel(label), c);
        c.gridx = 1;
        c.weightx = 1;
        form.add(field, c);
        c.gridx = 2;
        c.weightx = 0;
        JButton button = new JButton("Browse");
        button.setEnabled(browse != null);
        if (browse != null) button.addActionListener(event -> browse.run());
        form.add(button, c);
    }

    private static void chooseDirectory(Component parent, JTextField field) {
        JFileChooser chooser = new JFileChooser();
        chooser.setFileSelectionMode(JFileChooser.DIRECTORIES_ONLY);
        if (chooser.showOpenDialog(parent) == JFileChooser.APPROVE_OPTION) {
            field.setText(chooser.getSelectedFile().getAbsolutePath());
        }
    }

    private static void chooseFile(Component parent, JTextField field) {
        JFileChooser chooser = new JFileChooser();
        chooser.setFileSelectionMode(JFileChooser.FILES_ONLY);
        if (chooser.showOpenDialog(parent) == JFileChooser.APPROVE_OPTION) {
            File file = chooser.getSelectedFile();
            field.setText(file.getAbsolutePath());
        }
    }
}
