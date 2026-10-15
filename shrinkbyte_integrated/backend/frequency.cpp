#include <climits>
#include "frequency.h"
#include <iostream>
#include <fstream>

using namespace std;

bool calculateFrequency(string filename, int frequency[256]) {
    for (int i = 0; i < 256; i++) {
        frequency[i] = 0;
    }

    ifstream file(filename, ios::binary);

    if (!file) {
        cout << "File cannot be opened" << endl;
        return false;
    }
    unsigned char ch;

    while (file.read((char*)&ch, 1)) {
        if (frequency[ch] == INT_MAX)
            return false;

        frequency[ch]++;
    }
    if (file.bad())
        return false;

    file.close();
    return true;
}

bool calculateFrequency(const uint8_t *data, size_t len, int frequency[256]) {
    for (int i = 0; i < 256; i++) frequency[i] = 0;
    if (data == nullptr && len != 0) return false;
    if (len > static_cast<size_t>(INT_MAX)) return false;
    for (size_t i = 0; i < len; i++) frequency[data[i]]++;
    return true;
}

void displayFrequency(int frequency[256]) {
    cout << "Frequency Table:" << endl;

    for (int i = 0; i < 256; i++) {
        if (frequency[i] != 0) {
            cout << "Byte " << i << " : " << frequency[i] << endl;
        }
    }
}
