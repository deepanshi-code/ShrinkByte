//#include "huffman.hpp"
#include <cstdint>
#include <fstream>
#include <queue>
#include <string>
#include <vector>
namespace huffman 
{
namespace 
{
const char MAGIC[4] = {'S', 'B', 'H', 'F'};
struct Node 
{
    uint64_t freq;
    int sym;
    int order;
    int left;
    int right;
};
struct Tree 
{
    std::vector<Node> nodes;
    int root = -1;
};
Tree buildTree(const uint64_t freq[256]) 
{
    Tree t;
    auto cmp = [&t](int a, int b) 
    {
        const Node& x = t.nodes[a];
        const Node& y = t.nodes[b];
        if (x.freq != y.freq) return x.freq > y.freq;
        return x.order > y.order;
    };
    std::priority_queue<int, std::vector<int>, decltype(cmp)> pq(cmp);
    int order = 0;
    for (int s = 0; s < 256; s++) 
    {
        if (freq[s] > 0) {
            t.nodes.push_back({freq[s], s, order++, -1, -1});
            pq.push((int)t.nodes.size() - 1);
        }
    }
    if (pq.empty()) return t;
    while (pq.size() > 1) 
    {
        int a = pq.top(); pq.pop();
        int b = pq.top(); pq.pop();
        t.nodes.push_back({t.nodes[a].freq + t.nodes[b].freq, -1, order++, a, b});
        pq.push((int)t.nodes.size() - 1);
    }
    t.root = pq.top();
    return t;
}
void generateCodes(const Tree& t, int idx, std::string& cur,std::vector<std::string>& codes) 
{
    const Node& n = t.nodes[idx];
    if (n.left == -1 && n.right == -1) 
    {
        codes[n.sym] = cur.empty() ? "0" : cur;
        return;
    }
    cur.push_back('0');
    generateCodes(t, n.left, cur, codes);
    cur.back() = '1';
    generateCodes(t, n.right, cur, codes);
    cur.pop_back();
}
void writeU64(std::ostream& o, uint64_t v) 
{
    for (int i = 0; i < 8; i++) o.put((char)((v >> (8 * i)) & 0xFF));
}
void writeU16(std::ostream& o, uint16_t v) 
{
    o.put((char)(v & 0xFF));
    o.put((char)((v >> 8) & 0xFF));
}
bool readU64(std::istream& in, uint64_t& v) 
{
    v = 0;
    for (int i = 0; i < 8; i++) 
    {
        int c = in.get();
        if (c == EOF) return false;
        v |= (uint64_t)(uint8_t)c << (8 * i);
    }
    return true;
}
bool readU16(std::istream& in, uint16_t& v) 
{
    int a = in.get(), b = in.get();
    if (a == EOF || b == EOF) return false;
    v = (uint16_t)(a | (b << 8));
    return true;
}
}
bool compress(const std::string& inPath, const std::string& outPath) 
{
    std::ifstream in(inPath, std::ios::binary);
    if (!in) return false;
    uint64_t freq[256] = {0};
    uint64_t total = 0;
    {
        std::vector<char> buf(1 << 16);
        while (in) {
            in.read(buf.data(), buf.size());
            std::streamsize n = in.gcount();
            for (std::streamsize i = 0; i < n; i++) freq[(uint8_t)buf[i]]++;
            total += (uint64_t)n;
        }
    }
    Tree tree = buildTree(freq);
    std::vector<std::string> codes(256);
    if (tree.root != -1) 
    {
        std::string cur;
        generateCodes(tree, tree.root, cur, codes);
    }
    std::ofstream out(outPath, std::ios::binary);
    if (!out) return false;
    out.write(MAGIC, 4);
    writeU64(out, total);
    uint16_t unique = 0;
    for (int s = 0; s < 256; s++) if (freq[s]) unique++;
    writeU16(out, unique);
    for (int s = 0; s < 256; s++) 
    {
        if (freq[s]) {
            out.put((char)s);
            writeU64(out, freq[s]);
        }
    }
    in.clear();
    in.seekg(0);
    uint8_t cur = 0;
    int bits = 0;
    std::vector<char> buf(1 << 16);
    while (in) {
        in.read(buf.data(), buf.size());
        std::streamsize n = in.gcount();
        for (std::streamsize i = 0; i < n; i++) 
        {
            for (char c : codes[(uint8_t)buf[i]]) 
            {
                cur = (uint8_t)((cur << 1) | (c == '1'));
                if (++bits == 8) 
                {
                    out.put((char)cur);
                    cur = 0;
                    bits = 0;
                }
            }
        }
    }
    if (bits > 0) 
    {
        cur = (uint8_t)(cur << (8 - bits));
        out.put((char)cur);
    }
    return (bool)out;
}
bool decompress(const std::string& inPath, const std::string& outPath) 
{
    std::ifstream in(inPath, std::ios::binary);
    if (!in) return false;
    char magic[4];
    in.read(magic, 4);
    if (in.gcount() != 4 || std::string(magic, 4) != std::string(MAGIC, 4))
        return false;
    uint64_t total;
    uint16_t unique;
    if (!readU64(in, total) || !readU16(in, unique)) return false;
    uint64_t freq[256] = {0};
    for (int i = 0; i < unique; i++) 
    {
        int s = in.get();
        uint64_t f;
        if (s == EOF || !readU64(in, f)) return false;
        freq[s] = f;
    }
    std::ofstream out(outPath, std::ios::binary);
    if (!out) return false;
    if (total == 0) return true;
    Tree tree = buildTree(freq);
    if (tree.root == -1) return false;
    if (tree.nodes[tree.root].left == -1) 
    {
        char c = (char)tree.nodes[tree.root].sym;
        for (uint64_t i = 0; i < total; i++) out.put(c);
        return (bool)out;
    }
    uint64_t written = 0;
    int cur = tree.root;
    while (written < total) 
    {
        int byte = in.get();
        if (byte == EOF) return false;
        for (int b = 7; b >= 0 && written < total; b--) 
        {
            int bit = (byte >> b) & 1;
            cur = bit ? tree.nodes[cur].right : tree.nodes[cur].left;
            if (tree.nodes[cur].left == -1) 
            {
                out.put((char)tree.nodes[cur].sym);
                written++;
                cur = tree.root;
            }
        }
    }
    return (bool)out;
}
}