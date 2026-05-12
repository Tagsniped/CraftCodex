package craftpath.packbuilder;

import java.util.*;

public final class Json {
    private Json() {}

    public static Object parse(String text) {
        return new Parser(text).parse();
    }

    public static String stringify(Object value) {
        StringBuilder out = new StringBuilder();
        write(value, out);
        return out.toString();
    }

    @SuppressWarnings("unchecked")
    private static void write(Object value, StringBuilder out) {
        if (value == null) {
            out.append("null");
        } else if (value instanceof String text) {
            out.append('"');
            for (int i = 0; i < text.length(); i++) {
                char ch = text.charAt(i);
                switch (ch) {
                    case '"' -> out.append("\\\"");
                    case '\\' -> out.append("\\\\");
                    case '\b' -> out.append("\\b");
                    case '\f' -> out.append("\\f");
                    case '\n' -> out.append("\\n");
                    case '\r' -> out.append("\\r");
                    case '\t' -> out.append("\\t");
                    default -> {
                        if (ch < 32) out.append(String.format("\\u%04x", (int) ch));
                        else out.append(ch);
                    }
                }
            }
            out.append('"');
        } else if (value instanceof Number || value instanceof Boolean) {
            out.append(value);
        } else if (value instanceof Map<?, ?> map) {
            out.append('{');
            boolean first = true;
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                if (!first) out.append(',');
                first = false;
                write(String.valueOf(entry.getKey()), out);
                out.append(':');
                write(entry.getValue(), out);
            }
            out.append('}');
        } else if (value instanceof Iterable<?> list) {
            out.append('[');
            boolean first = true;
            for (Object item : list) {
                if (!first) out.append(',');
                first = false;
                write(item, out);
            }
            out.append(']');
        } else {
            write(String.valueOf(value), out);
        }
    }

    private static final class Parser {
        private final String text;
        private int at;

        Parser(String text) {
            this.text = text;
        }

        Object parse() {
            Object value = readValue();
            skipWhitespace();
            if (at != text.length()) throw error("Unexpected trailing content");
            return value;
        }

        private Object readValue() {
            skipWhitespace();
            if (at >= text.length()) throw error("Unexpected end of JSON");
            char ch = text.charAt(at);
            if (ch == '"') return readString();
            if (ch == '{') return readObject();
            if (ch == '[') return readArray();
            if (ch == 't' && text.startsWith("true", at)) {
                at += 4;
                return true;
            }
            if (ch == 'f' && text.startsWith("false", at)) {
                at += 5;
                return false;
            }
            if (ch == 'n' && text.startsWith("null", at)) {
                at += 4;
                return null;
            }
            return readNumber();
        }

        private Map<String, Object> readObject() {
            Map<String, Object> map = new LinkedHashMap<>();
            at++;
            skipWhitespace();
            if (peek('}')) {
                at++;
                return map;
            }
            while (true) {
                skipWhitespace();
                String key = readString();
                skipWhitespace();
                expect(':');
                map.put(key, readValue());
                skipWhitespace();
                if (peek('}')) {
                    at++;
                    return map;
                }
                expect(',');
            }
        }

        private List<Object> readArray() {
            List<Object> list = new ArrayList<>();
            at++;
            skipWhitespace();
            if (peek(']')) {
                at++;
                return list;
            }
            while (true) {
                list.add(readValue());
                skipWhitespace();
                if (peek(']')) {
                    at++;
                    return list;
                }
                expect(',');
            }
        }

        private String readString() {
            expect('"');
            StringBuilder out = new StringBuilder();
            while (at < text.length()) {
                char ch = text.charAt(at++);
                if (ch == '"') return out.toString();
                if (ch != '\\') {
                    out.append(ch);
                    continue;
                }
                if (at >= text.length()) throw error("Bad escape");
                char esc = text.charAt(at++);
                switch (esc) {
                    case '"' -> out.append('"');
                    case '\\' -> out.append('\\');
                    case '/' -> out.append('/');
                    case 'b' -> out.append('\b');
                    case 'f' -> out.append('\f');
                    case 'n' -> out.append('\n');
                    case 'r' -> out.append('\r');
                    case 't' -> out.append('\t');
                    case 'u' -> {
                        if (at + 4 > text.length()) throw error("Bad unicode escape");
                        out.append((char) Integer.parseInt(text.substring(at, at + 4), 16));
                        at += 4;
                    }
                    default -> throw error("Bad escape");
                }
            }
            throw error("Unclosed string");
        }

        private Number readNumber() {
            int start = at;
            if (peek('-')) at++;
            while (at < text.length() && Character.isDigit(text.charAt(at))) at++;
            if (peek('.')) {
                at++;
                while (at < text.length() && Character.isDigit(text.charAt(at))) at++;
            }
            if (at < text.length() && (text.charAt(at) == 'e' || text.charAt(at) == 'E')) {
                at++;
                if (at < text.length() && (text.charAt(at) == '+' || text.charAt(at) == '-')) at++;
                while (at < text.length() && Character.isDigit(text.charAt(at))) at++;
            }
            String number = text.substring(start, at);
            if (number.contains(".") || number.contains("e") || number.contains("E")) return Double.parseDouble(number);
            return Long.parseLong(text.substring(start, at));
        }

        private void skipWhitespace() {
            while (at < text.length() && Character.isWhitespace(text.charAt(at))) at++;
        }

        private boolean peek(char ch) {
            return at < text.length() && text.charAt(at) == ch;
        }

        private void expect(char ch) {
            if (!peek(ch)) throw error("Expected " + ch);
            at++;
        }

        private RuntimeException error(String message) {
            return new IllegalArgumentException(message + " at " + at);
        }
    }
}
