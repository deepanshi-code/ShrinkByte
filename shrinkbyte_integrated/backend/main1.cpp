#include "HuffmanEncoderheader1.h"
#include <cstdio>
#include <cstring>
#include <fstream>
#include <iostream>
#include <iterator>

using namespace std;

static const char* NOT_COMPRESSIBLE_MSG =
    "File can't be compressed further down. Original file will be used as it is.";

static bool readFile(const string& path, vector<uint8_t>& v)
{
    ifstream in(path, ios::binary);

    if (!in)
        return false;

    v.assign(istreambuf_iterator<char>(in),
             istreambuf_iterator<char>());

    return true;
}

static void demo()
{
    HuffmanEncoder encoder;
    string sampleText = "BEEP BOOP BEER!";
    map<unsigned char, int> freqMap;

    for (unsigned char c : sampleText)
        freqMap[c]++;

    encoder.buildTree(freqMap);
    encoder.buildCodes();

    cout << "SHRINK BYTE: HUFFMAN CODES\n";

    for (const auto& pair : encoder.getCodes())
        cout << "'" << pair.first << "' : "
             << pair.second << "\n";

    string bits = encoder.encodeStringToBits(sampleText);

    cout << "\nOriginal Text : " << sampleText
         << " (" << sampleText.size() * 8 << " bits)\n";
    cout << "Encoded Bits  : " << bits
         << " (" << bits.size() << " bits)\n";

    if (!sampleText.empty())
    {
        double saved =
            100.0 - (bits.size() * 100.0 /
                     (sampleText.size() * 8));
        cout << "Space Saved   : " << saved << "%\n";
    }
}

static bool roundTrip(const char* name,
                      const vector<uint8_t>& original,
                      bool expectCompressible)
{
    HuffmanEncoder enc, dec;
    vector<uint8_t> packed, restored;

    HuffmanStatus s =
        enc.compressBuffer(original.data(), original.size(), packed);

    if (s == HuffmanStatus::NOT_COMPRESSIBLE)
    {
        bool ok = !expectCompressible;
        cout << "[" << (ok ? "PASS" : "FAIL") << "] "
             << name << " " << original.size()
             << " bytes -> not compressible, original kept\n";
        return ok;
    }

    if (s == HuffmanStatus::OK)
        s = dec.decompressBuffer(
            packed.data(), packed.size(), restored);

    bool ok = (s == HuffmanStatus::OK &&
               expectCompressible &&
               restored == original &&
               packed.size() < original.size());

    cout << "[" << (ok ? "PASS" : "FAIL") << "] "
         << name << " " << original.size()
         << " -> " << packed.size() << " bytes\n";

    if (s != HuffmanStatus::OK)
        cout << "       status: "
             << huffmanStatusToString(s) << "\n";

    return ok;
}

static bool tiesAreDeterministic()
{
    map<unsigned char, int> freq;
    for (int i = 0; i < 16; ++i)
        freq[static_cast<unsigned char>('a' + i)] = 5;

    HuffmanEncoder a, b;
    a.buildTree(freq);
    a.buildCodes();
    b.buildTree(freq);
    b.buildCodes();

    return a.getCodes() == b.getCodes();
}

static int runTests()
{
    int failed = 0;

    vector<uint8_t> empty;
    vector<uint8_t> one(1, 'A');
    vector<uint8_t> tiny;
    for (char c : string("hello"))
        tiny.push_back(static_cast<uint8_t>(c));
    vector<uint8_t> repeated(1000, 'Z');

    string t =
        "BEEP BOOP BEER! the quick brown fox jumps over the lazy dog. ";

    vector<uint8_t> text;

    for (int i = 0; i < 50; ++i)
        text.insert(text.end(), t.begin(), t.end());

    vector<uint8_t> binary;
    unsigned x = 12345;

    for (int i = 0; i < 20000; ++i)
    {
        x = x * 1103515245u + 12345u;
        binary.push_back((x >> 16) & 0xFF);
    }

    vector<uint8_t> allBytes;

    for (int i = 0; i < 256; ++i)
        allBytes.push_back(static_cast<uint8_t>(i));

    failed += !roundTrip("empty file", empty, false);
    failed += !roundTrip("single byte", one, false);
    failed += !roundTrip("tiny file", tiny, false);
    failed += !roundTrip("one unique byte x1000", repeated, true);
    failed += !roundTrip("text", text, true);
    failed += !roundTrip("binary (pseudo-random)", binary, false);
    failed += !roundTrip("all 256 byte values", allBytes, false);

    bool tie = tiesAreDeterministic();
    cout << "[" << (tie ? "PASS" : "FAIL") << "] tie-break deterministic\n";
    failed += !tie;

    HuffmanEncoder enc, dec;
    vector<uint8_t> packed, out;

    enc.compressBuffer(text.data(), text.size(), packed);

    vector<uint8_t> bad = packed;
    bad[0] = 'X';

    HuffmanStatus s =
        dec.decompressBuffer(bad.data(), bad.size(), out);

    bool ok = (s == HuffmanStatus::BAD_MAGIC);

    cout << "[" << (ok ? "PASS" : "FAIL")
         << "] bad magic -> "
         << huffmanStatusToString(s) << "\n";

    failed += !ok;

    vector<uint8_t> cut(packed.begin(), packed.end() - 10);

    s = dec.decompressBuffer(cut.data(), cut.size(), out);
    ok = (s == HuffmanStatus::TRUNCATED_DATA);

    cout << "[" << (ok ? "PASS" : "FAIL")
         << "] truncated payload -> "
         << huffmanStatusToString(s) << "\n";

    failed += !ok;

    vector<uint8_t> hdr(packed.begin(), packed.begin() + 8);

    s = dec.decompressBuffer(hdr.data(), hdr.size(), out);
    ok = (s == HuffmanStatus::TRUNCATED_DATA);

    cout << "[" << (ok ? "PASS" : "FAIL")
         << "] truncated header -> "
         << huffmanStatusToString(s) << "\n";

    failed += !ok;

    vector<uint8_t> mism = packed;
    mism[4] ^= 0x01;

    s = dec.decompressBuffer(mism.data(), mism.size(), out);
    ok = (s == HuffmanStatus::SIZE_MISMATCH);

    cout << "[" << (ok ? "PASS" : "FAIL")
         << "] size mismatch -> "
         << huffmanStatusToString(s) << "\n";

    failed += !ok;

    cout << "\n"
         << (failed ? "SOME TESTS FAILED" : "ALL TESTS PASSED")
         << "\n";

    return failed ? 1 : 0;
}

static int verifyFile(const string& path)
{
    vector<uint8_t> original, packed, restored;

    if (!readFile(path, original))
    {
        cerr << "Cannot open " << path << "\n";
        return 1;
    }

    HuffmanEncoder enc, dec;
    HuffmanStatus s =
        enc.compressBuffer(original.data(), original.size(), packed);

    if (s == HuffmanStatus::NOT_COMPRESSIBLE)
    {
        cout << path << ": " << original.size() << " bytes. "
             << NOT_COMPRESSIBLE_MSG << "\n";
        return 0;
    }

    if (s == HuffmanStatus::OK)
        s = dec.decompressBuffer(
            packed.data(), packed.size(), restored);

    if (s != HuffmanStatus::OK)
    {
        cerr << "Error: "
             << huffmanStatusToString(s) << "\n";
        return 1;
    }

    bool same = (restored == original);

    cout << path << ": " << original.size()
         << " -> " << packed.size()
         << " bytes, round trip "
         << (same ? "IDENTICAL" : "MISMATCH") << "\n";

    return same ? 0 : 1;
}

int main(int argc, char* argv[])
{
    if (argc == 1)
    {
        demo();
        return 0;
    }

    string cmd = argv[1];

    if (cmd == "demo")
    {
        demo();
        return 0;
    }

    if (cmd == "test")
        return runTests();

    if (cmd == "verify" && argc == 3)
        return verifyFile(argv[2]);

    if ((cmd == "compress" || cmd == "decompress") &&
        argc == 4)
    {
        HuffmanEncoder codec;

        HuffmanStatus s =
            (cmd == "compress")
                ? codec.compressFile(argv[2], argv[3])
                : codec.decompressFile(argv[2], argv[3]);

        if (s == HuffmanStatus::NOT_COMPRESSIBLE)
        {
            cout << NOT_COMPRESSIBLE_MSG << "\n";
            return 0;
        }

        if (s != HuffmanStatus::OK)
        {
            cerr << "Error: "
                 << huffmanStatusToString(s) << "\n";
            return 1;
        }

        cout << (cmd == "compress"
                     ? "Compressed "
                     : "Decompressed ")
             << argv[2] << " -> " << argv[3] << "\n";

        return 0;
    }

    cerr << "Usage:\n"
         << "  " << argv[0] << " compress <input> <output.sb>\n"
         << "  " << argv[0] << " decompress <input.sb> <output>\n"
         << "  " << argv[0] << " verify <file>\n"
         << "  " << argv[0] << " test\n"
         << "  " << argv[0] << " demo\n";

    return 1;
}
